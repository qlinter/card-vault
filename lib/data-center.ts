import "server-only";
import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type { Card, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseCsv, validateTable, validateXlsxArchive } from "./tabular-data.js";
import { importFields, type ImportMapping } from "./data-center-fields";
import { buildCardData, normalizeCardFormValues } from "./card-entry-domain";
import { createInitialFinancialHistory } from "./card-entry-finance-service";
import { parseInitialCardQuantity } from "./card-quantity";
import { optionalCardDate } from "./card-domain";
import { moneyValue } from "./financial-history";

const evidenceInclude = { transactions: { orderBy: { id: "asc" } }, expenses: { orderBy: { id: "asc" } }, valuations: { orderBy: { id: "asc" } }, images: { orderBy: { id: "asc" } }, shareItems: { orderBy: { id: "asc" } } } as const;
const json = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
const fingerprint = (value: unknown) => createHash("sha256").update(json(value)).digest("hex");
type Input = { values: Record<string, string | boolean>; existingId?: string; expected?: string; validationError?: string };
type Options = { policy: "skip" | "update" | "separate"; kind: "import" };

function assertImportJob(job: { kind: string; optionsJson: string }) {
  if (job.kind !== "import" || JSON.parse(job.optionsJson).kind !== "import") throw new Error("批次格式不受支持，请使用当前文件导入流程。");
}

export async function readImportFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB。");
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error("请选择 CSV 或 XLSX 文件。");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateXlsxArchive(bytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = book.worksheets[0];
  if (!sheet || sheet.rowCount > 10001 || sheet.columnCount > 80) throw new Error("首个工作表为空或超过 10000 行 / 80 列。");
  const rows: string[][] = [];
  sheet.eachRow(row => {
    const values: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = row.getCell(column);
      if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) throw new Error("请将公式或错误单元格转换为明确的值后导入。");
      values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
    }
    rows.push(values);
  });
  return validateTable(rows);
}

function normalizeValues(raw: Record<string, string | boolean>) {
  const values = normalizeCardFormValues(raw);
  if (!("initialQuantity" in raw) && ["sold", "target"].includes(values.collectionStatus)) values.initialQuantity = "0";
  return values;
}
function validateInitial(raw: Record<string, string | boolean>) {
  const values = normalizeValues(raw), data = buildCardData(values);
  const quantity = parseInitialCardQuantity(values.initialQuantity, data.collectionStatus);
  if (quantity > 100000 || (["sold", "target"].includes(data.collectionStatus) && quantity !== 0)) throw new Error("初始数量与收藏状态不一致或超过限制。");
  const purchaseDate = optionalCardDate(values.purchaseDate, "购买日期"), valuedAt = optionalCardDate(values.valuationDate, "估值日期");
  if ((values.purchasePrice || quantity > 1) && !purchaseDate) throw new Error("填写购买价格或多张数量时需要购买日期。");
  if (values.purchasePrice && !quantity) throw new Error("数量为 0 时不能填写购买价格。");
  for (const amount of [values.purchasePrice, values.currentValue].filter(Boolean)) moneyValue({ amount, currency: values.historyCurrency });
  if (values.currentValue && (!valuedAt || !values.valuationSource)) throw new Error("估值需要日期和来源。");
  return { values, data, quantity };
}
async function findMatch(tx: Prisma.TransactionClient, values: Record<string, string | boolean>) {
  if (values.id) return tx.card.findUniqueOrThrow({ where: { id: String(values.id) }, include: evidenceInclude });
  const where: Prisma.CardWhereInput = values.certNumber ? { certNumber: String(values.certNumber) } : {
    playerName: String(values.playerName ?? ""), cardTitle: String(values.cardTitle ?? ""), sport: String(values.sport ?? ""),
    year: values.year ? String(values.year) : null, parallel: values.parallel ? String(values.parallel) : null, serialNumber: values.serialNumber ? String(values.serialNumber) : null
  };
  const matches = await tx.card.findMany({ where, take: 2, include: evidenceInclude });
  if (matches.length > 1) throw new Error("匹配到多张卡片，请映射明确的卡片 ID。");
  return matches[0] ?? null;
}
function metadataPatch(card: Card, raw: Input["values"]) {
  const merged = normalizeCardFormValues({ ...card, ...raw });
  const data = buildCardData(merged);
  if ("collectionStatus" in raw && raw.collectionStatus !== card.collectionStatus) throw new Error("已有卡片的收藏状态请在详情页按交易数量调整。");
  return Object.fromEntries(Object.entries(data).filter(([key]) => key in raw && key !== "collectionStatus")) as Prisma.CardUpdateInput;
}

export async function previewImport(headers: string[], rows: string[][], mapping: ImportMapping, policy: Options["policy"]) {
  validateTable([headers, ...rows]);
  const targets = Object.values(mapping).filter(Boolean);
  if (!targets.length || targets.some(field => !Object.hasOwn(importFields, field)) || new Set(targets).size !== targets.length || Object.keys(mapping).some(key => !headers.includes(key))) throw new Error("字段映射无效或重复。");
  if (!["skip", "update", "separate"].includes(policy)) throw new Error("重复处理方式无效。");
  const inputs: Input[] = rows.map(row => ({ values: Object.fromEntries(headers.flatMap<[string, string | boolean]>((header, index) => {
    const field = mapping[header];
    if (!field) return [];
    const value = row[index] ?? "";
    if (["isRookie", "isPatch", "isAutograph", "isSerialNumbered"].includes(field)) {
      if (!/^(true|false|1|0|是|否|)$/i.test(value)) return [[field, value]];
      return [[field, /^(true|1|是)$/i.test(value)]];
    }
    return [[field, value]];
  })) }));
  return createPreview(inputs, { policy, kind: "import" });
}
export async function repreviewJob(id: string) {
  const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  const options = JSON.parse(job.optionsJson) as Options;
  assertImportJob(job);
  return createPreview(job.rows.map(row => ({ values: (JSON.parse(row.inputJson) as Input).values })), options, randomUUID());
}
async function createPreview(inputs: Input[], options: Options, newBatch = "") {
  const token = fingerprint({ version: 1, inputs, options, newBatch });
  const existing = await prisma.bulkJob.findUnique({ where: { token } });
  if (existing) return getJob(existing.id);
  for (const input of inputs) {
    try {
      for (const [field, value] of Object.entries(input.values)) if (["isRookie", "isPatch", "isAutograph", "isSerialNumbered"].includes(field) && typeof value !== "boolean") throw new Error("布尔字段只接受 true / false、1 / 0、是 / 否。");
      const card = await findMatch(prisma, input.values);
      if (card && !(options.policy === "separate" && !input.values.id)) {
        input.existingId = card.id; input.expected = fingerprint(card);
        if (options.policy === "update") {
          metadataPatch(card, input.values);
          if (["purchasePrice", "purchaseDate", "currentValue", "initialQuantity"].some(key => input.values[key])) throw new Error("更新已有卡片仅接受档案字段；估值和交易请在详情页记录。");
        }
      } else validateInitial(input.values);
    } catch (error) { input.validationError = error instanceof Error ? error.message : "预演失败。"; }
  }
  const job = await prisma.bulkJob.create({ data: { token, kind: options.kind, optionsJson: json(options), rows: { create: inputs.map((input, index) => ({ rowNumber: index + 2, inputJson: json(input), status: input.validationError ? "failed" : "pending", error: input.validationError ?? null, cardId: input.existingId })) } } });
  return getJob(job.id);
}
export async function getJob(id: string) {
  const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  assertImportJob(job);
  return { id: job.id, kind: job.kind, status: job.status, createdAt: job.createdAt.toISOString(), rows: job.rows.map(row => ({ id: row.id, rowNumber: row.rowNumber, status: row.status, error: row.error, cardId: row.cardId, values: (JSON.parse(row.inputJson) as Input).values })) };
}

// Each row is a transaction. Replaying a request never repeats a committed row.
export async function applyJob(id: string, undo = false, cursor?: number) {
  const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id } });
  assertImportJob(job);
  if (job.status === "undone" && !undo) throw new Error("此批次已撤销。");
  const options = JSON.parse(job.optionsJson) as Options;
  const candidates = await prisma.bulkJobRow.findMany({ where: { jobId: id, status: { in: undo ? ["applied", "undo-failed"] : ["pending", "failed"] }, ...(cursor === undefined ? {} : { rowNumber: undo ? { lt: cursor } : { gt: cursor } }) }, orderBy: { rowNumber: undo ? "desc" : "asc" }, take: 50 });
  for (const candidate of candidates) {
    try {
      await prisma.$transaction(async tx => {
        const row = await tx.bulkJobRow.findUniqueOrThrow({ where: { id: candidate.id } });
        if (!(undo ? ["applied", "undo-failed"] : ["pending", "failed"]).includes(row.status)) return;
        const input = JSON.parse(row.inputJson) as Input;
        if (undo) {
          const current = await tx.card.findUnique({ where: { id: row.cardId! }, include: evidenceInclude });
          const after = JSON.parse(row.afterJson!) as { fingerprint: string };
          if (!current || fingerprint(current) !== after.fingerprint) throw new Error("卡片已被后续修改，不能自动撤销。");
          if (!row.beforeJson) await tx.card.delete({ where: { id: current.id } });
          else {
            const before = JSON.parse(row.beforeJson) as Card;
            await tx.card.update({ where: { id: current.id }, data: { ...before, purchaseDate: before.purchaseDate ? new Date(before.purchaseDate) : null, createdAt: new Date(before.createdAt), updatedAt: new Date(before.updatedAt) } });
          }
          await tx.bulkJobRow.update({ where: { id: row.id }, data: { status: "undone", error: null } });
          return;
        }
        if (input.validationError) throw new Error(input.validationError);
        let card = input.existingId ? await tx.card.findUniqueOrThrow({ where: { id: input.existingId }, include: evidenceInclude }) : null;
        if (card && options.policy === "skip") { await tx.bulkJobRow.update({ where: { id: row.id }, data: { status: "skipped", error: null } }); return; }
        if (card && fingerprint(card) !== input.expected) throw new Error("预演后卡片发生变化，请重新建立批次。");
        let beforeJson: string | null = null;
        if (card) {
          const { transactions, expenses, valuations, images, shareItems, ...before } = card;
          void transactions; void expenses; void valuations; void images; void shareItems;
          beforeJson = json(before);
          await tx.card.update({ where: { id: card.id }, data: metadataPatch(card, input.values) });
        } else {
          const match = options.policy === "separate" ? null : await findMatch(tx, input.values);
          if (match) {
            if (options.policy === "skip") { await tx.bulkJobRow.update({ where: { id: row.id }, data: { status: "skipped", cardId: match.id, error: null } }); return; }
            throw new Error("执行期间出现重复卡片，请重新预演。");
          }
          const { values, data, quantity } = validateInitial(input.values);
          const created = await tx.card.create({ data: { ...data, holdingQuantity: quantity } });
          await createInitialFinancialHistory(tx, created.id, values, data.gradingCompany, quantity);
          card = await tx.card.findUniqueOrThrow({ where: { id: created.id }, include: evidenceInclude });
        }
        const current = await tx.card.findUniqueOrThrow({ where: { id: card.id }, include: evidenceInclude });
        await tx.bulkJobRow.update({ where: { id: row.id }, data: { status: "applied", error: null, cardId: card.id, beforeJson, afterJson: json({ fingerprint: fingerprint(current) }) } });
      }, { timeout: 15000 });
    } catch (error) {
      await prisma.bulkJobRow.updateMany({ where: { id: candidate.id, status: { in: undo ? ["applied", "undo-failed"] : ["pending", "failed"] } }, data: { status: undo ? "undo-failed" : "failed", error: error instanceof Error ? error.message : "操作失败。" } });
    }
  }
  const counts = await prisma.bulkJobRow.groupBy({ by: ["status"], where: { jobId: id }, _count: true });
  const has = (status: string) => counts.some(row => row.status === status);
  const status = undo ? has("undo-failed") ? "undo-partial" : has("applied") ? "undo-running" : "undone" : has("pending") ? "running" : has("failed") ? "partial" : "complete";
  await prisma.bulkJob.update({ where: { id }, data: { status } });
  return { ...await getJob(id), nextCursor: candidates.length === 50 ? candidates.at(-1)!.rowNumber : null };
}

