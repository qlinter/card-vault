import { DisclosureIcon } from "./disclosure-icon";
import { CollectionViewToggle } from "./view-mode-toggle";
import { UiText, UiElement } from "@/components/ui-text";
type FilterBarProps = {
  query: Record<string, string | undefined>;
  sports: string[];
  teams: string[];
  years: string[];
  brands: string[];
  productLines: string[];
  subsetNames: string[];
  parallels: string[];
  gradingCompanies: string[];
  grades: string[];
  autoTypes: string[];
  patchTypes: string[];
};

const advancedFilterFields = [
  "brand", "subsetName", "parallel", "cardNumber", "isSerialNumbered", "isOneOfOne", "isRookie",
  "isAutograph", "autoType", "isPatch", "patchType", "isGraded", "gradingCompany",
  "grade", "certNumber", "visibility", "collectionStatus"
] as const;

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function hasAdvancedFilters(query: Record<string, string | undefined>): boolean {
  return advancedFilterFields.some((field) => hasValue(query[field]));
}

function BooleanFilter({ name, label, value }: { name: string; label: string; value?: string }) {
  return (
    <select name={name} defaultValue={value ?? ""}>
      <option value=""><UiText text={label} /></option>
      <option value="true"><UiText text={"是"} /></option>
      <option value="false"><UiText text={"否"} /></option>
    </select>
  );
}

export function FilterBar({
  query,
  sports,
  teams,
  years,
  brands,
  productLines,
  subsetNames,
  parallels,
  gradingCompanies,
  grades,
  autoTypes,
  patchTypes
}: FilterBarProps) {
  const advancedOpen = hasAdvancedFilters(query);
  const hasAnyFilter = Boolean(
    query.q || query.sport || query.team || query.year || query.productLine || query.sort || advancedOpen
  );

  return (
    <form className="panel" method="get">
      <div className="filters">
        <UiElement as="input" uiAttributes={["placeholder"]}
          name="q"
          placeholder="搜索卡片主体 / 卡名 / 品牌 / 产品线 / 卡号 / 标签 / 年份 / 评级 / 证书号"
          defaultValue={query.q ?? ""}
        />

        <select name="sport" defaultValue={query.sport ?? ""}>
          <option value="">{<UiText text={"运动类型"} />}</option>
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>

        <select name="team" defaultValue={query.team ?? ""}>
          <option value="">Team</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select name="year" defaultValue={query.year ?? ""}>
          <option value="">{<UiText text={"年份"} />}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select name="productLine" defaultValue={query.productLine ?? ""}>
          <option value="">{<UiText text={"产品线"} />}</option>
          {productLines.map((productLine) => (
            <option key={productLine} value={productLine}>
              {productLine}
            </option>
          ))}
        </select>

        <select name="sort" defaultValue={query.sort ?? "newest"}>
          <option value="newest">{<UiText text={"最新录入"} />}</option>
          <option value="yearAsc">{<UiText text={"年份升序"} />}</option>
          <option value="yearDesc">{<UiText text={"年份降序"} />}</option>
          <option value="costCnyAsc">{<UiText text={"报表币种剩余成本升序"} />}</option>
          <option value="costCnyDesc">{<UiText text={"报表币种剩余成本降序"} />}</option>
          <option value="valueCnyAsc">{<UiText text={"报表币种持仓估值升序"} />}</option>
          <option value="valueCnyDesc">{<UiText text={"报表币种持仓估值降序"} />}</option>
        </select>
      </div>

      <details className="filter-details" open={advancedOpen}>
        <summary><span><UiText text="更多筛选" /></span><DisclosureIcon expanded={false} /></summary>
        <div className="filters filter-details-grid">
          <select name="brand" defaultValue={query.brand ?? ""}>
            <option value="">{<UiText text={"品牌"} />}</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          <select name="subsetName" defaultValue={query.subsetName ?? ""}>
            <option value="">{<UiText text={"子系列"} />}</option>
            {subsetNames.map((subsetName) => (
              <option key={subsetName} value={subsetName}>{subsetName}</option>
            ))}
          </select>

          <select name="parallel" defaultValue={query.parallel ?? ""}>
            <option value="">{<UiText text={"平行版本"} />}</option>
            {parallels.map((parallel) => (
              <option key={parallel} value={parallel}>{parallel}</option>
            ))}
          </select>

          <UiElement as="input" uiAttributes={["placeholder"]} name="cardNumber" placeholder="卡号" defaultValue={query.cardNumber ?? ""} />

          <BooleanFilter name="isSerialNumbered" label="限量卡" value={query.isSerialNumbered} />
          <BooleanFilter name="isOneOfOne" label="1/1" value={query.isOneOfOne} />
          <BooleanFilter name="isRookie" label="Rookie" value={query.isRookie} />
          <BooleanFilter name="isAutograph" label="签名卡" value={query.isAutograph} />

          <select name="autoType" defaultValue={query.autoType ?? ""}>
            <option value="">{<UiText text={"签字类型"} />}</option>
            {autoTypes.map((autoType) => (
              <option key={autoType} value={autoType}>{autoType}</option>
            ))}
          </select>

          <BooleanFilter name="isPatch" label="Patch/Jersey" value={query.isPatch} />

          <select name="patchType" defaultValue={query.patchType ?? ""}>
            <option value="">Patch {<UiText text={"类型"} />}</option>
            {patchTypes.map((patchType) => (
              <option key={patchType} value={patchType}>{patchType}</option>
            ))}
          </select>

          <BooleanFilter name="isGraded" label="已评级" value={query.isGraded} />

          <select name="gradingCompany" defaultValue={query.gradingCompany ?? ""}>
            <option value="">{<UiText text={"评级机构"} />}</option>
            {gradingCompanies.map((gradingCompany) => (
              <option key={gradingCompany} value={gradingCompany}>{gradingCompany}</option>
            ))}
          </select>

          <select name="grade" defaultValue={query.grade ?? ""}>
            <option value="">{<UiText text={"评级"} />}</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>

          <UiElement as="input" uiAttributes={["placeholder"]} name="certNumber" placeholder="证书号" defaultValue={query.certNumber ?? ""} />

          <select name="visibility" defaultValue={query.visibility ?? ""}>
            <option value="">{<UiText text={"公开状态"} />}</option>
            <option value="private">{<UiText text={"私密"} />}</option>
            <option value="public">{<UiText text={"公开"} />}</option>
            <option value="linkOnly">{<UiText text={"仅链接可见"} />}</option>
          </select>

          <select name="collectionStatus" defaultValue={query.collectionStatus ?? ""}>
            <option value="">{<UiText text={"收藏状态"} />}</option>
            <option value="holding">{<UiText text={"持有中"} />}</option>
            <option value="listed">{<UiText text={"在售"} />}</option>
            <option value="sold">{<UiText text={"已售出"} />}</option>
            <option value="grading">{<UiText text={"送评中"} />}</option>
            <option value="target">{<UiText text={"目标卡"} />}</option>
          </select>
        </div>
      </details>

      <div className="filter-actions" data-testid="home-filter-actions">
        <div className="filter-main-actions">
          <button type="submit" className="btn btn-secondary">
            {<UiText text={"搜索 / 筛选"} />}
          </button>
          <a href="/" className="btn btn-secondary">
            {<UiText text={"清空条件"} />}
          </a>
        </div>
        <div className="filter-display-actions"><a href="/cards/new" className="btn btn-primary filter-add-card">
          {<UiText text={"新增卡片"} />}
        </a><CollectionViewToggle compact /></div>
      </div>

      {hasAnyFilter ? (
        <p className="muted" style={{ marginTop: "0.7rem" }}>
          {<UiText text={"当前已应用筛选条件"} />}
        </p>
      ) : null}
    </form>
  );
}
