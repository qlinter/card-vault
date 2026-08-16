import { NextRequest, NextResponse } from "next/server";
import { ensureAiSettings } from "@/lib/ai-settings";
import { AiUpstreamError, aiProviderName, requestAiChatTextResult } from "@/lib/ai-chat-client";
import { extractJsonRecord } from "@/lib/ai-response-parsing";
import { errorMessage } from "@/lib/feedback-messages";
import { buildCardFilters } from "@/lib/card-helpers";
import { portfolioAnalysisCardSelect } from "@/lib/card-query-shapes";
import { prisma } from "@/lib/prisma";
import {
  buildFallbackPortfolioAnalysis,
  buildPortfolioClientSnapshot,
  buildPortfolioScope,
  buildPortfolioSnapshot,
  completePortfolioAnalysis,
  normalizePortfolioAnalysis,
  normalizePortfolioFilterInput,
  portfolioAnalysisPrompt,
  type PortfolioAnalysis,
  type PortfolioSnapshot
} from "@/lib/portfolio-analysis";

export const runtime = "nodejs";

const maximumAnalysisCardCount = 5000;
type AiSettings = ReturnType<typeof ensureAiSettings>;

async function requestedSnapshot(value: unknown): Promise<PortfolioSnapshot> {
  const query = normalizePortfolioFilterInput(value);
  const where = buildCardFilters(query);
  const cardCount = await prisma.card.count({ where });
  if (cardCount === 0) throw new Error("当前筛选范围内没有可分析的卡片。");
  if (cardCount > maximumAnalysisCardCount) throw new Error(`当前筛选结果超过 ${maximumAnalysisCardCount} 张，请缩小范围后重试。`);

  const cards = await prisma.card.findMany({ where, select: portfolioAnalysisCardSelect });
  return buildPortfolioSnapshot(
    cards.map((card) => ({ ...card, imageCount: card._count.images })),
    buildPortfolioScope(query)
  );
}

function parseAnalysis(rawText: string, snapshot: PortfolioSnapshot): PortfolioAnalysis {
  return completePortfolioAnalysis(normalizePortfolioAnalysis(extractJsonRecord(rawText)), snapshot);
}

async function repairAnalysis(settings: AiSettings, rawText: string, snapshot: PortfolioSnapshot): Promise<PortfolioAnalysis> {
  const result = await requestAiChatTextResult(settings, {
    messages: [
      { role: "system", content: "You repair JSON. Return only one strict JSON object and never add facts." },
      {
        role: "user",
        content: [
          "Repair this response into analysisVersion 2 JSON.",
          "Required top-level keys: analysisVersion, executiveSummary, scorecard, sections, attentionItems, actionItems.",
          "All five scorecard values must be objects with score, non-empty explanation, dataSufficiency, and evidence.",
          "All five sections must contain exactly one complete finding. Return 2-4 complete actionItems. Never use 暂无判断. Output JSON only.",
          rawText.slice(0, 14000)
        ].join("\n")
      }
    ],
    maxTokens: 5000,
    temperature: 0,
    responseFormat: "json_object",
    timeoutMs: 90000,
    operation: "组合分析格式修复"
  });
  return parseAnalysis(result.text, snapshot);
}

async function remoteAnalysis(settings: AiSettings, snapshot: PortfolioSnapshot): Promise<PortfolioAnalysis> {
  const failures: string[] = [];
  const standardPrompt = portfolioAnalysisPrompt(snapshot, "standard");
  let firstText = "";
  let firstFinishReason: string | null = null;

  console.info(`[portfolio-analysis] provider=${settings.provider} cards=${snapshot.cardCount} snapshotChars=${JSON.stringify(snapshot).length} promptChars=${standardPrompt.length}`);

  try {
    const first = await requestAiChatTextResult(settings, {
      messages: [
        { role: "system", content: "你是严谨的收藏卡组合分析助手，只使用提供的汇总数据，并只输出严格 JSON 对象。" },
        { role: "user", content: standardPrompt }
      ],
      maxTokens: 6000,
      temperature: settings.provider === "azure" ? 0.1 : 0.2,
      responseFormat: "json_object",
      timeoutMs: 120000,
      operation: "组合分析"
    });
    firstText = first.text;
    firstFinishReason = first.finishReason;
    console.info(`[portfolio-analysis] firstResponseChars=${first.text.length} finishReason=${first.finishReason ?? "unknown"}`);
    return parseAnalysis(first.text, snapshot);
  } catch (error) {
    failures.push(`首次生成：${errorMessage(error, "失败").slice(0, 240)}`);
  }

  if (firstText && firstFinishReason !== "length" && firstFinishReason !== "max_tokens") {
    try {
      return await repairAnalysis(settings, firstText, snapshot);
    } catch (error) {
      failures.push(`格式修复：${errorMessage(error, "失败").slice(0, 240)}`);
    }
  } else if (firstText) {
    failures.push(`首次生成：输出被截断（${firstFinishReason}）`);
  }

  try {
    const compactPrompt = portfolioAnalysisPrompt(snapshot, "compact");
    const regenerated = await requestAiChatTextResult(settings, {
      messages: [
        { role: "system", content: "你是严谨的收藏卡组合分析助手。返回简洁、完整、严格的 JSON 对象，不得省略必要键。" },
        { role: "user", content: compactPrompt }
      ],
      maxTokens: 6000,
      temperature: 0,
      responseFormat: "json_object",
      timeoutMs: 120000,
      operation: "组合分析精简重试"
    });
    console.info(`[portfolio-analysis] compactResponseChars=${regenerated.text.length} finishReason=${regenerated.finishReason ?? "unknown"}`);
    return parseAnalysis(regenerated.text, snapshot);
  } catch (error) {
    failures.push(`精简重试：${errorMessage(error, "失败").slice(0, 240)}`);
  }

  throw new AiUpstreamError(failures.join("；"));
}

export async function POST(request: NextRequest) {
  let snapshot: PortfolioSnapshot | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    snapshot = await requestedSnapshot(body.query);
    const settings = ensureAiSettings();
    const provider = aiProviderName(settings.provider, settings.provider === "custom" ? settings.name : undefined);
    const clientSnapshot = buildPortfolioClientSnapshot(snapshot);

    try {
      const analysis = await remoteAnalysis(settings, snapshot);
      return NextResponse.json({ analysis, snapshot: clientSnapshot, provider, fallback: false });
    } catch (error) {
      console.warn(`[portfolio-analysis] remote analysis exhausted; using local fallback: ${errorMessage(error, "unknown").slice(0, 500)}`);
      return NextResponse.json({
        analysis: buildFallbackPortfolioAnalysis(snapshot),
        snapshot: clientSnapshot,
        provider: `${provider}（本地统计兜底）`,
        fallback: true,
        warning: `${provider} 本次未能返回完整结果，已自动改用本地汇总分析。你可以直接查看报告，也可以稍后重新分析。`
      });
    }
  } catch (error) {
    const message = errorMessage(error, "组合分析失败，请稍后重试。");
    return NextResponse.json({ error: message, snapshot: snapshot ? buildPortfolioClientSnapshot(snapshot) : undefined }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
