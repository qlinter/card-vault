import { Card, CardImage } from "@prisma/client";
import { AiRecognitionPanel } from "@/components/ai-recognition-panel";
import { InvestmentInputs } from "@/components/investment-inputs";
import { splitTagString, stringifyTags } from "@/lib/card-helpers";
import { CardFormValues } from "@/lib/card-form-values";
import { normalizeImagePath } from "@/lib/image-path";
import { encodeReturnTo } from "@/lib/query-params";

type CardFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  card?: Card & { images: CardImage[] };
  values?: CardFormValues;
  returnTo?: string;
};

function pickValue(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export function CardForm({ mode, action, error, card, values, returnTo }: CardFormProps) {
  const tags = splitTagString(card?.tags ?? null);
  const defaultAiImageUrls = card?.images.slice(0, 2).map((image) => normalizeImagePath(image.path)) ?? [];

  return (
    <form action={action} className="panel" encType="multipart/form-data">
      {error ? <p className="note-error">{error}</p> : null}
      {mode === "edit" && returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <AiRecognitionPanel mode={mode} defaultImageUrls={defaultAiImageUrls} />

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
          <span>Team</span>
          <input name="team" defaultValue={pickValue(values?.team, card?.team ?? "")} />
        </label>

        <label className="field">
          <span>年份</span>
          <input name="year" type="text" placeholder="例如 2016-17" defaultValue={pickValue(values?.year, card?.year ?? "")} />
        </label>

        <label className="field">
          <span>品牌</span>
          <input name="brand" placeholder="例如 Panini / Topps" defaultValue={pickValue(values?.brand, card?.brand ?? "")} />
        </label>

        <label className="field">
          <span>产品线</span>
          <input name="productLine" placeholder="例如 Prizm / Select / Immaculate" defaultValue={pickValue(values?.productLine, card?.productLine ?? "")} />
        </label>

        <label className="field">
          <span>子系列</span>
          <input name="subsetName" defaultValue={pickValue(values?.subsetName, card?.subsetName ?? "")} />
        </label>

        <label className="field">
          <span>平行版本</span>
          <input name="parallel" placeholder="例如 Gold / Mojo / Refractor" defaultValue={pickValue(values?.parallel, card?.parallel ?? "")} />
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

        <label className="field">
          <span>证书号</span>
          <input name="certNumber" defaultValue={pickValue(values?.certNumber, card?.certNumber ?? "")} />
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

        {mode === "create" ? (
          <>
            <div className="form-section-heading full">
              <div>
                <h2>初始财务记录</h2>
                <p>这些内容会分别保存为购买交易、评级费用和估值记录，之后请在卡片详情页继续维护。</p>
              </div>
            </div>

            <label className="field">
              <span>购买日期</span>
              <input name="purchaseDate" type="date" defaultValue={values?.purchaseDate ?? ""} />
            </label>

            <label className="field">
              <span>购买渠道</span>
              <input name="purchaseSource" defaultValue={values?.purchaseSource ?? ""} />
            </label>

            <InvestmentInputs
              purchasePrice={values?.purchasePrice ?? ""}
              gradingFee={values?.gradingFee ?? ""}
              totalCost={values?.totalCost ?? ""}
              currentValue={values?.currentValue ?? ""}
              currency={values?.historyCurrency ?? "CNY"}
              valuationDate={values?.valuationDate ?? ""}
              valuationSource={values?.valuationSource ?? "个人估计"}
            />
          </>
        ) : (
          <div className="history-edit-notice full">
            <strong>财务记录已从卡片资料中分离</strong>
            <span>购买、费用和估值请在卡片详情页的“财务历史”中新增或编辑，保存本页不会改写历史记录。</span>
            <a href={`/cards/${card?.id}#financial-history`}>前往财务历史</a>
          </div>
        )}

        <label className="field">
          <span>公开状态</span>
          <select name="visibility" defaultValue={pickValue(values?.visibility, card?.visibility ?? "private")}>
            <option value="private">私密</option>
            <option value="public">公开</option>
            <option value="linkOnly">仅链接可见</option>
          </select>
        </label>

        <label className="field">
          <span>收藏状态</span>
          <select name="collectionStatus" defaultValue={pickValue(values?.collectionStatus, card?.collectionStatus ?? "holding")}>
            <option value="holding">持有中</option>
            <option value="listed">在售</option>
            <option value="sold">已售出</option>
            <option value="grading">送评中</option>
            <option value="target">目标卡</option>
          </select>
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
            placeholder="这段文字会显示在展示或分享的单卡详情中。"
          />
        </label>

        <label className="field full">
          <span>备注</span>
          <textarea name="notes" defaultValue={pickValue(values?.notes, card?.notes ?? "")} />
        </label>

        <label className="field">
          <span>
            <input name="isRookie" type="checkbox" defaultChecked={values?.isRookie ?? card?.isRookie ?? false} /> 是否 Rookie
          </span>
        </label>

        <label className="field">
          <span>
            <input name="isAutograph" type="checkbox" defaultChecked={values?.isAutograph ?? card?.isAutograph ?? false} /> 是否签名卡
          </span>
        </label>

        <label className="field">
          <span>签字类型</span>
          <input name="autoType" placeholder="例如 on-card / sticker" defaultValue={pickValue(values?.autoType, card?.autoType ?? "")} />
        </label>

        <label className="field">
          <span>
            <input name="isPatch" type="checkbox" defaultChecked={values?.isPatch ?? card?.isPatch ?? false} /> 是否 Patch/Jersey
          </span>
        </label>

        <label className="field">
          <span>Patch 类型</span>
          <input name="patchType" placeholder="例如 multi-color / logo patch" defaultValue={pickValue(values?.patchType, card?.patchType ?? "")} />
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
        <a href={mode === "create" ? "/" : `/cards/${card?.id}${encodeReturnTo(returnTo)}`} className="btn btn-secondary">
          取消
        </a>
      </div>
    </form>
  );
}
