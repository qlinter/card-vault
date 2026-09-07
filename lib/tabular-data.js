const maxRows = 10000;
const maxColumns = 80;
function parseCsv(text) {
  if (Buffer.byteLength(text, "utf8") > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB。");
  const rows = [];
  let row = [], cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  function pushCell() { if (cell.length > 10000 || row.length >= maxColumns) throw new Error("单元格或列数超过限制。"); row.push(cell); cell = ""; closed = false; }
  function pushRow() { pushCell(); if (row.some(value => value !== "")) rows.push(row); row = []; if (rows.length > maxRows + 1) throw new Error("每批最多 10000 行。"); }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += char; }
    else if (char === ",") pushCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && text[i + 1] === "\n") i++; pushRow(); }
    else if (char === '"' && !cell && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error("CSV 引号格式无效。"); cell += char; }
  }
  if (quoted) throw new Error("CSV 引号未闭合。");
  if (cell || row.length || closed) pushRow();
  return validateTable(rows);
}
function validateTable(rows) {
  if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row))) throw new Error("表格数据格式无效。");
  if (rows.length < 2) throw new Error("请提供表头和至少一行数据。");
  const headers = rows[0].map(value => String(value).trim());
  if (!headers.length || headers.length > maxColumns || headers.some(value => !value || value.length > 160) || new Set(headers).size !== headers.length) throw new Error("表头不能为空、重复或超过限制。");
  if (rows.length > maxRows + 1 || rows.some(row => row.length > headers.length || row.some(cell => String(cell).length > 10000))) throw new Error("行列数量或单元格长度超过限制。");
  return { headers, rows: rows.slice(1).map(row => headers.map((_, i) => String(row[i] ?? ""))) };
}
function encodeCsv(rows) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}
// Inspect the central directory before the XLSX parser allocates decompressed XML.
function validateXlsxArchive(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error("XLSX 压缩包无效。");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16), size = 0;
  if (count > 4000 || count === 65535) throw new Error("XLSX 内容超过限制。");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50 || buffer.readUInt16LE(offset + 8) & 1) throw new Error("不支持损坏或加密的 XLSX。");
    size += buffer.readUInt32LE(offset + 24);
    if (size > 50 * 1024 * 1024) throw new Error("XLSX 解压内容不能超过 50 MB。");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset > end) throw new Error("XLSX 压缩目录无效。");
}
module.exports = { parseCsv, encodeCsv, validateTable, validateXlsxArchive, maxRows, maxColumns };
