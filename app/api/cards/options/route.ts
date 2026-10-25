import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [years, brands, lines] = await Promise.all([
    prisma.card.groupBy({ by: ["year"], where: { year: { not: null } }, _count: { id: true }, orderBy: [{ _count: { id: "desc" } }, { year: "desc" }], take: 100 }),
    prisma.card.groupBy({ by: ["brand"], where: { brand: { not: null } }, _count: { id: true }, orderBy: [{ _count: { id: "desc" } }, { brand: "asc" }], take: 100 }),
    prisma.card.groupBy({ by: ["productLine"], where: { productLine: { not: null } }, _count: { id: true }, orderBy: [{ _count: { id: "desc" } }, { productLine: "asc" }], take: 100 })
  ]);
  return NextResponse.json({ year: years.flatMap(row => row.year ? [row.year] : []), brand: brands.flatMap(row => row.brand ? [row.brand] : []), productLine: lines.flatMap(row => row.productLine ? [row.productLine] : []) }, { headers: { "Cache-Control": "no-store" } });
}
