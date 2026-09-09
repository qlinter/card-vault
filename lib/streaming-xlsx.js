const fs = require('node:fs');
const path = require('node:path');
const { writeStreamingZip } = require('./streaming-zip');

const xml = value => String(value).replace(/_x[0-9a-f]{4}_/gi, match => '_x005F_' + match.slice(1))
  // eslint-disable-next-line no-control-regex -- XML 1.0 forbids these characters; encode them for Excel.
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, value => `_x${value.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function bufferedFile(file, signal) {
  const handle = await fs.promises.open(file, 'wx', 0o600);
  let parts = [], size = 0;
  async function flush() {
    signal?.throwIfAborted();
    if (size) { await handle.writeFile(parts.join('')); parts = []; size = 0; }
  }
  return {
    async append(text) { signal?.throwIfAborted(); parts.push(text); size += Buffer.byteLength(text); if (size >= 65536) await flush(); },
    async close() { try { await flush(); } finally { await handle.close(); } },
    async abort() { await handle.close(); }
  };
}

function columnName(index) {
  let name = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
function rowXml(values, number, header = false) {
  return `<row r="${number}">` + values.map((value, index) => {
    const attrs = `r="${columnName(index)}${number}"${header ? ' s="1"' : ''}`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c ${attrs} t="n"><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c ${attrs} t="b"><v>${Number(value)}</v></c>`;
    return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(value ?? '')}</t></is></c>`;
  }).join('') + '</row>';
}

/** @param {string} directory @param {Array<{name:string, headers:string[], rows:AsyncIterable<unknown[]>}>} sources @param {AbortSignal | undefined} signal @param {number} rowLimit */
async function writeStreamingXlsx(directory, sources, signal, rowLimit = 1048576) {
  if (!Number.isInteger(rowLimit) || rowLimit < 2 || rowLimit > 1048576) throw new Error('Invalid worksheet row limit');
  const sheets = [];
  for (const source of sources) {
    let writer, rows = 0, part = 0;
    async function openSheet() {
      part++;
      const name = source.name + (part === 1 ? '' : ` ${part}`);
      const file = `sheet${sheets.length + 1}.xml`;
      sheets.push({ name, file });
      writer = await bufferedFile(path.join(directory, file), signal);
      await writer.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${source.headers.length}" width="22" customWidth="1"/></cols><sheetData>`);
      rows = 1;
      await writer.append(rowXml(source.headers, rows, true));
    }
    async function closeSheet() { await writer.append('</sheetData></worksheet>'); await writer.close(); writer = null; }
    try {
      await openSheet();
      for await (const row of source.rows) {
        if (rows === rowLimit) { await closeSheet(); await openSheet(); }
        await writer.append(rowXml(row, ++rows));
      }
      await closeSheet();
    } finally { if (writer) await writer.abort(); }
  }
  signal?.throwIfAborted();
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const relationship = (id, type, target) => `<Relationship Id="rId${id}" Type="${rel}/${type}" Target="${target}"/>`;
  const relationships = body => `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
  const smallFiles = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map(sheet => `<Override PartName="/xl/worksheets/${sheet.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': relationships(relationship(1, 'officeDocument', 'xl/workbook.xml')),
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${main}" xmlns:r="${rel}"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': relationships(sheets.map((sheet, index) => relationship(index + 1, 'worksheet', `worksheets/${sheet.file}`)).join('') + relationship(sheets.length + 1, 'styles', 'styles.xml')),
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`
  };
  const output = path.join(directory, 'export.xlsx');
  await writeStreamingZip(output, [
    ...Object.entries(smallFiles).map(([name, content]) => ({ name, content })),
    ...sheets.map(sheet => ({ name: `xl/worksheets/${sheet.file}`, path: path.join(directory, sheet.file) }))
  ], signal);
  return output;
}

module.exports = { bufferedFile, writeStreamingXlsx };
