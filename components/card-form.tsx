import { Card, CardImage } from "@prisma/client";
import { splitTagString, stringifyTags } from "@/lib/card-helpers";
import { CardFormValues } from "@/lib/card-form-values";
import { normalizeImagePath } from "@/lib/image-path";

type CardFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  card?: Card & { images: CardImage[] };
  values?: CardFormValues;
};

function formatDate(date: Date | null): string {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

function formatCurrencyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return `${value}`;
}

function pickValue(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export function CardForm({ mode, action, error, card, values }: CardFormProps) {
  const tags = splitTagString(card?.tags ?? null);

  return (
    <form action={action} className="panel" encType="multipart/form-data">
      {error ? <p className="note-error">{error}</p> : null}

      <div className="form-grid">
        <label className="field">
          <span>球员姓名 *</span>
          <input name="playerName" required defaultValue={pickValue(values?.playerName, card?.playerName ?? "")} />
        </label>

        <label className="field">
          <span>卡片名称 *</span>
          <input name="cardTitle" required defaultValue={pickValue(values?.cardTitle, card?.cardTitle ?? "")} />
        </label>

        <label className="field">
          <span>运动类型 *</span>
          <input
            name="sport"
            required
            placeholder="篮球 / 足球 / 棒球"
            defaultValue={pickValue(values?.sport, card?.sport ?? "")}
          />
        </label>

        <label className="field">
          <span>球队</span>
          <input name="team" defaultValue={pickValue(values?.team, card?.team ?? "")} />
        </label>

        <label className="field">
          <span>年份</span>
          <input name="year" type="text" placeholder="例如 2016-17" defaultValue={pickValue(values?.year, card?.year ?? "")} />
        </label>

        <label className="field">
          <span>系列 / 产品线</span>
          <input name="setName" defaultValue={pickValue(values?.setName, card?.setName ?? "")} />
        </label>

        <label className="field">
          <span>卡号</span>
          <input name="cardNumber" defaultValue={pickValue(values?.cardNumber, card?.cardNumber ?? "")} />
        </label>

        <label className="field">
          <span>编号</span>
          <input name="serialNumber" defaultValue={pickValue(values?.serialNumber, card?.serialNumber ?? "")} />
        </label>

        <label className="field">
          <span>编号范围</span>
          <input name="serialRange" placeholder="例如 /99" defaultValue={pickValue(values?.serialRange, card?.serialRange ?? "")} />
        </label>

        <label className="field">
          <span>评级机构</span>
          <input name="gradingCompany" defaultValue={pickValue(values?.gradingCompany, card?.gradingCompany ?? "")} />
        </label>

        <label className="field">
          <span>评级</span>
          <input
            name="grade"
            type="text"
            placeholder="例如 9.5 / Auto Auth / Authentic"
            defaultValue={pickValue(values?.grade, card?.grade ?? "")}
          />
        </label>

        <label className="field full">
          <span>评级链接</span>
          <input
            name="gradingLink"
            type="url"
            placeholder="https://www.psacard.com/..."
            defaultValue={pickValue(values?.gradingLink, card?.gradingLink ?? "")}
          />
        </label>

        <label className="field">
          <span>购买日期</span>
          <input
            name="purchaseDate"
            type="date"
            defaultValue={pickValue(values?.purchaseDate, formatDate(card?.purchaseDate ?? null))}
          />
        </label>

        <label className="field">
          <span>购买价格</span>
          <input
            name="purchasePrice"
            type="text"
            inputMode="decimal"
            defaultValue={pickValue(values?.purchasePrice, formatCurrencyInput(card?.purchasePrice))}
          />
        </label>

        <label className="field">
          <span>当前估值</span>
          <input
            name="currentValue"
            type="text"
            inputMode="decimal"
            defaultValue={pickValue(values?.currentValue, formatCurrencyInput(card?.currentValue))}
          />
        </label>

        <label className="field">
          <span>购买渠道</span>
          <input name="purchaseSource" defaultValue={pickValue(values?.purchaseSource, card?.purchaseSource ?? "")} />
        </label>

        <label className="field full">
          <span>标签（逗号分隔）</span>
          <input name="tags" placeholder="rookie, holo, psa" defaultValue={pickValue(values?.tags, stringifyTags(tags))} />
        </label>

        <label className="field full">
          <span>展示描述</span>
          <textarea
            name="publicDescription"
            defaultValue={pickValue(values?.publicDescription, card?.publicDescription ?? "")}
            placeholder="这段文字会显示在对外展示页的单卡详情中。"
          />
        </label>

        <label className="field full">
          <span>备注</span>
          <textarea name="notes" defaultValue={pickValue(values?.notes, card?.notes ?? "")} />
        </label>

        <label className="field">
          <span>
            <input name="isAutograph" type="checkbox" defaultChecked={values?.isAutograph ?? card?.isAutograph ?? false} /> 是否签名卡
          </span>
        </label>

        <label className="field">
          <span>
            <input name="isPatch" type="checkbox" defaultChecked={values?.isPatch ?? card?.isPatch ?? false} /> 是否 Patch/Jersey
          </span>
        </label>

        <label className="field full">
          <span>{mode === "create" ? "上传图片（1-5 张）*" : "新增图片（可选，单张卡总计最多 5 张）"}</span>
          <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          {mode === "create" ? <small className="muted">提交失败时，文字和勾选项会保留；图片需要重新选择。</small> : null}
        </label>
      </div>

      {mode === "edit" && card ? (
        <div style={{ marginTop: "1rem" }}>
          <h3>现有图片（勾选即删除）</h3>
          <div className="gallery">
            {card.images.map((image) => (
              <label key={image.id} className="field" style={{ fontWeight: 500 }}>
                <img src={normalizeImagePath(image.path)} alt={card.cardTitle} />
                <span>
                  <input type="checkbox" name="removeImageIds" value={image.id} /> 删除此图
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem" }}>
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "保存并创建" : "保存修改"}
        </button>
        <a href={mode === "create" ? "/" : `/cards/${card?.id}`} className="btn btn-secondary">
          取消
        </a>
      </div>
    </form>
  );
}
