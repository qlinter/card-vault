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

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function hasAdvancedFilters(query: Record<string, string | undefined>): boolean {
  return Boolean(
    query.brand ||
      query.subsetName ||
      query.parallel ||
      query.cardNumber ||
      query.serialNumber ||
      query.serialRange ||
      query.gradingCompany ||
      query.grade ||
      query.certNumber ||
      query.autoType ||
      query.patchType ||
      query.visibility ||
      query.collectionStatus ||
      hasValue(query.isRookie) ||
      hasValue(query.isAutograph) ||
      hasValue(query.isPatch) ||
      hasValue(query.isGraded)
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
        <input
          name="q"
          placeholder="搜索球员 / 卡名 / 品牌 / 产品线 / 卡号 / 标签 / 年份 / 评级 / 证书号"
          defaultValue={query.q ?? ""}
        />

        <select name="sport" defaultValue={query.sport ?? ""}>
          <option value="">{"运动类型"}</option>
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>

        <select name="team" defaultValue={query.team ?? ""}>
          <option value="">{"球队"}</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select name="year" defaultValue={query.year ?? ""}>
          <option value="">{"年份"}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select name="productLine" defaultValue={query.productLine ?? ""}>
          <option value="">{"产品线"}</option>
          {productLines.map((productLine) => (
            <option key={productLine} value={productLine}>
              {productLine}
            </option>
          ))}
        </select>

        <select name="sort" defaultValue={query.sort ?? "newest"}>
          <option value="newest">{"最新录入"}</option>
          <option value="yearAsc">{"年份升序"}</option>
          <option value="yearDesc">{"年份降序"}</option>
          <option value="priceAsc">{"价格升序"}</option>
          <option value="priceDesc">{"价格降序"}</option>
        </select>
      </div>

      <details className="filter-details" open={advancedOpen}>
        <summary>{"更多筛选"}</summary>
        <div className="filters filter-details-grid">
          <select name="brand" defaultValue={query.brand ?? ""}>
            <option value="">{"品牌"}</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          <select name="subsetName" defaultValue={query.subsetName ?? ""}>
            <option value="">{"子系列"}</option>
            {subsetNames.map((subsetName) => (
              <option key={subsetName} value={subsetName}>{subsetName}</option>
            ))}
          </select>

          <select name="parallel" defaultValue={query.parallel ?? ""}>
            <option value="">{"平行版本"}</option>
            {parallels.map((parallel) => (
              <option key={parallel} value={parallel}>{parallel}</option>
            ))}
          </select>

          <input name="cardNumber" placeholder="卡号" defaultValue={query.cardNumber ?? ""} />
          <input name="serialNumber" placeholder="编号" defaultValue={query.serialNumber ?? ""} />
          <input name="serialRange" placeholder="编号范围，例如 /99" defaultValue={query.serialRange ?? ""} />

          <select name="isRookie" defaultValue={query.isRookie ?? ""}>
            <option value="">Rookie</option>
            <option value="true">{"是"}</option>
            <option value="false">{"否"}</option>
          </select>

          <select name="isAutograph" defaultValue={query.isAutograph ?? ""}>
            <option value="">{"签名卡"}</option>
            <option value="true">{"是"}</option>
            <option value="false">{"否"}</option>
          </select>

          <select name="autoType" defaultValue={query.autoType ?? ""}>
            <option value="">{"签字类型"}</option>
            {autoTypes.map((autoType) => (
              <option key={autoType} value={autoType}>{autoType}</option>
            ))}
          </select>

          <select name="isPatch" defaultValue={query.isPatch ?? ""}>
            <option value="">Patch/Jersey</option>
            <option value="true">{"是"}</option>
            <option value="false">{"否"}</option>
          </select>

          <select name="patchType" defaultValue={query.patchType ?? ""}>
            <option value="">Patch {"类型"}</option>
            {patchTypes.map((patchType) => (
              <option key={patchType} value={patchType}>{patchType}</option>
            ))}
          </select>

          <select name="isGraded" defaultValue={query.isGraded ?? ""}>
            <option value="">{"已评级"}</option>
            <option value="true">{"是"}</option>
            <option value="false">{"否"}</option>
          </select>

          <select name="gradingCompany" defaultValue={query.gradingCompany ?? ""}>
            <option value="">{"评级机构"}</option>
            {gradingCompanies.map((gradingCompany) => (
              <option key={gradingCompany} value={gradingCompany}>{gradingCompany}</option>
            ))}
          </select>

          <select name="grade" defaultValue={query.grade ?? ""}>
            <option value="">{"评级"}</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>

          <input name="certNumber" placeholder="证书号" defaultValue={query.certNumber ?? ""} />

          <select name="visibility" defaultValue={query.visibility ?? ""}>
            <option value="">{"公开状态"}</option>
            <option value="private">{"私密"}</option>
            <option value="public">{"公开"}</option>
            <option value="linkOnly">{"仅链接可见"}</option>
          </select>

          <select name="collectionStatus" defaultValue={query.collectionStatus ?? ""}>
            <option value="">{"收藏状态"}</option>
            <option value="holding">{"持有中"}</option>
            <option value="listed">{"在售"}</option>
            <option value="sold">{"已售出"}</option>
            <option value="grading">{"送评中"}</option>
            <option value="target">{"目标卡"}</option>
          </select>
        </div>
      </details>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
        <button type="submit" className="btn btn-primary">
          {"搜索 / 筛选"}
        </button>
        <a href="/" className="btn btn-secondary">
          {"清空条件"}
        </a>
      </div>

      {hasAnyFilter ? (
        <p className="muted" style={{ marginTop: "0.7rem" }}>
          {"当前已应用筛选条件"}
        </p>
      ) : null}
    </form>
  );
}
