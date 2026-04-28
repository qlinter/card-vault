import { CreateCardForm } from "@/components/create-card-form";

export default function NewCardPage() {
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">新增球星卡</h1>
          <p className="muted">必填：球员姓名、卡片名称、运动类型，以及至少 1 张图片。</p>
        </div>
      </div>
      <CreateCardForm />
    </div>
  );
}
