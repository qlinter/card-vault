const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { parseCsv, encodeCsv, validateTable, validateXlsxArchive } = require("../lib/tabular-data");
test("CSV preserves quoted commas, line breaks, unicode and leading zero identifiers", () => {
  assert.deepEqual(parseCsv('\uFEFFName,Number,Notes\r\n"卡,名",0012,"第一行\n""第二行"""'), { headers: ["Name", "Number", "Notes"], rows: [["卡,名", "0012", '第一行\n"第二行"']] });
  assert.throws(() => parseCsv('Name,Name\na,b'), /重复/);
  assert.throws(() => parseCsv('Name\n"unclosed'), /未闭合/);
  assert.throws(() => parseCsv('Name\na,b'), /行列/);
  assert.throws(() => validateTable([[], []]), /表头/);
  assert.throws(() => validateTable(["not a row", []]), /格式/);
  assert.throws(() => validateTable(null), /格式/);
});
test("CSV export neutralizes spreadsheet formulas without losing delimiters", () => {
  const result = parseCsv(encodeCsv([["name"], ["=HYPERLINK(\"bad\")"], ["\t@SUM(A1)"], ["普通文字"]]));
  assert.deepEqual(result.rows, [["'=HYPERLINK(\"bad\")"], ["'\t@SUM(A1)"], ["普通文字"]]);
});
test("XLSX preflight accepts real workbooks and rejects oversized decompression", async () => {
  const book = new ExcelJS.Workbook(); book.addWorksheet("Cards").addRows([["Name"], ["00123"]]);
  const bytes = Buffer.from(await book.xlsx.writeBuffer()); validateXlsxArchive(bytes);
  const copy = Buffer.from(bytes), start = copy.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  copy.writeUInt32LE(100 * 1024 * 1024, start + 24);
  assert.throws(() => validateXlsxArchive(copy), /50 MB/);
  assert.throws(() => validateXlsxArchive(Buffer.from("not zip")), /无效/);
});
