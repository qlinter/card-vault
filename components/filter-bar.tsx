type FilterBarProps = {
  query: Record<string, string | undefined>;
  sports: string[];
  teams: string[];
  years: string[];
  sets: string[];
};

function selected(value: string | undefined, expected: string): boolean {
  return value === expected;
}

export function FilterBar({ query, sports, teams, years, sets }: FilterBarProps) {
  return (
    <form className="panel" method="get">
      <div className="filters">
        <input name="q" placeholder="搜索球员/卡名/系列/球队/卡号/标签/年份/评级" defaultValue={query.q ?? ""} />

        <select name="sport" defaultValue={query.sport ?? ""}>
          <option value="">运动类型</option>
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>

        <select name="team" defaultValue={query.team ?? ""}>
          <option value="">球队</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select name="year" defaultValue={query.year ?? ""}>
          <option value="">年份</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select name="setName" defaultValue={query.setName ?? ""}>
          <option value="">系列</option>
          {sets.map((setName) => (
            <option key={setName} value={setName}>
              {setName}
            </option>
          ))}
        </select>

        <select name="isAutograph" defaultValue={query.isAutograph ?? ""}>
          <option value="">签名卡</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>

        <select name="isSerialNumbered" defaultValue={query.isSerialNumbered ?? ""}>
          <option value="">编号卡</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>

        <select name="isGraded" defaultValue={query.isGraded ?? ""}>
          <option value="">已评级</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>

        <select name="sort" defaultValue={query.sort ?? "newest"}>
          <option value="newest">最新录入</option>
          <option value="yearAsc">年份升序</option>
          <option value="yearDesc">年份降序</option>
          <option value="priceAsc">价格升序</option>
          <option value="priceDesc">价格降序</option>
          <option value="gradeAsc">评级升序</option>
          <option value="gradeDesc">评级降序</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
        <button type="submit" className="btn btn-primary">
          搜索/筛选
        </button>
        <a href="/" className="btn btn-secondary">
          清空条件
        </a>
      </div>

      {(query.q || query.sport || query.team || query.year || query.setName || selected(query.isAutograph, "true")) && (
        <p className="muted" style={{ marginTop: "0.7rem" }}>
          当前已应用筛选条件
        </p>
      )}
    </form>
  );
}
