import { CardForm } from "@/components/card-form";
import { createCardAction } from "@/app/actions/cards";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function NewCardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = toScalar(params.error);

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">新增球星卡</h1>
          <p className="muted">必填：球员姓名、卡片名称、运动类型、至少 1 张图片</p>
        </div>
      </div>
      <CardForm mode="create" action={createCardAction} error={error} />
    </div>
  );
}
