import {
  normalizeCardEntryTemplateName,
  normalizeCardEntryTemplateValues,
  parseCardEntryTemplateValues,
  type CardEntryTemplateSummary
} from "@/lib/card-entry-template-domain";
import { prisma } from "@/lib/prisma";

function summarizeTemplate(template: {
  id: string;
  name: string;
  valuesJson: string;
  useCount: number;
  lastUsedAt: Date | null;
  updatedAt: Date;
}): CardEntryTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    values: parseCardEntryTemplateValues(template.valuesJson),
    useCount: template.useCount,
    lastUsedAt: template.lastUsedAt?.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  };
}

export async function listCardEntryTemplates(): Promise<CardEntryTemplateSummary[]> {
  const templates = await prisma.cardEntryTemplate.findMany({
    orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
    take: 50
  });
  return templates.map(summarizeTemplate);
}

export async function createCardEntryTemplate(input: {
  name: unknown;
  values: unknown;
}): Promise<CardEntryTemplateSummary> {
  const name = normalizeCardEntryTemplateName(input.name);
  const existing = await prisma.cardEntryTemplate.count({ where: { name } });
  if (existing > 0) throw new Error("已存在同名模板，请更新现有模板或更换名称。");
  const template = await prisma.cardEntryTemplate.create({
    data: {
      name,
      valuesJson: JSON.stringify(normalizeCardEntryTemplateValues(input.values))
    }
  });
  return summarizeTemplate(template);
}

export async function updateCardEntryTemplate(
  id: string,
  input: { name?: unknown; values?: unknown }
): Promise<CardEntryTemplateSummary> {
  const existing = await prisma.cardEntryTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("模板不存在或已删除。");
  const name = input.name === undefined
    ? existing.name
    : normalizeCardEntryTemplateName(input.name);
  if (name !== existing.name) {
    const duplicate = await prisma.cardEntryTemplate.count({ where: { name } });
    if (duplicate > 0) throw new Error("已存在同名模板。");
  }
  const template = await prisma.cardEntryTemplate.update({
    where: { id },
    data: {
      name,
      valuesJson: input.values === undefined
        ? existing.valuesJson
        : JSON.stringify(normalizeCardEntryTemplateValues(input.values))
    }
  });
  return summarizeTemplate(template);
}

export async function markCardEntryTemplateUsed(id: string): Promise<CardEntryTemplateSummary> {
  const template = await prisma.cardEntryTemplate.update({
    where: { id },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() }
  });
  return summarizeTemplate(template);
}

export async function deleteCardEntryTemplate(id: string): Promise<void> {
  await prisma.cardEntryTemplate.deleteMany({ where: { id } });
}
