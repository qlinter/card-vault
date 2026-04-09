import { deleteCardAction } from "@/app/actions/cards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type DeleteProps = {
  params: Promise<{ id: string }>;
};

export default async function DeleteCardPage({ params }: DeleteProps) {
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id } });

  if (!card) {
    notFound();
  }

  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: "680px", margin: "0 auto" }}>
        <h1 className="h1">确认删除</h1>
        <p>即将删除：{card.playerName} - {card.cardTitle}</p>
        <p className="muted">删除后无法恢复，请再次确认。</p>

        <form action={deleteCardAction.bind(null, id)} style={{ display: "flex", gap: "0.7rem", marginTop: "1rem" }}>
          <button type="submit" className="btn btn-danger">
            确认删除
          </button>
          <a href={`/cards/${id}`} className="btn btn-secondary">
            返回详情
          </a>
        </form>
      </div>
    </div>
  );
}
