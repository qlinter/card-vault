const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ExcelJS = require('exceljs');
const { DatabaseSync } = require('node:sqlite');
const { writeStreamingXlsx } = require('../lib/streaming-xlsx');
const { snapshotExportDatabase } = require('../lib/export-database-snapshot');

test('streamed workbook preserves values, literal formulas, formatting and automatically splits sheets', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'card-vault-xlsx-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const rows=[['中文 <&> "', 42, true], ['=1+1', 0, false], ['literal _x0041_', '', 'line\nnext'], ['control\x00', 1, null]];
  async function* data() { yield* rows; }
  const file=await writeStreamingXlsx(root,[{name:'Cards', headers:['text','number','flag'],rows:data()}],undefined,3);
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(file);
  assert.deepEqual(book.worksheets.map(sheet=>sheet.name),['Cards','Cards 2']);
  const result=book.worksheets.flatMap(sheet=>{
    assert.equal(sheet.getCell('A1').font.bold,true);
    assert.equal(sheet.views[0].state,'frozen');
    assert.equal(sheet.getColumn(1).width,22);
    return [2,3].map(number=>[1,2,3].map(column=>sheet.getRow(number).getCell(column).value));
  });
  // ExcelJS does not decode OOXML escape sequences in inline strings.
  // Assert their wire representation as well as ordinary typed cell values.
  assert.deepEqual(result,[rows[0],rows[1],['literal _x005F_x0041_',null,'line\nnext'],['control_x0000_',1,null]]);
  assert.equal(book.worksheets[0].getCell('A3').type,ExcelJS.ValueType.String);
});

test('export snapshot is consistent after later edits and cancellation stops generation', async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'card-vault-export-snapshot-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=new DatabaseSync(path.join(root,'source.db'));source.exec('CREATE TABLE sample(id INTEGER); INSERT INTO sample VALUES(1)');
  const snapshot=path.join(root,'snapshot.db');await snapshotExportDatabase(path.join(root,'source.db'),snapshot);
  source.exec('INSERT INTO sample VALUES(2)');source.close();
  const copy=new DatabaseSync(snapshot,{readOnly:true});assert.equal(copy.prepare('SELECT count(*) n FROM sample').get().n,1);copy.close();
  const controller=new AbortController();controller.abort();
  await assert.rejects(snapshotExportDatabase(path.join(root,'source.db'),path.join(root,'cancel.db'),controller.signal),/abort/i);
  assert.equal(fs.existsSync(path.join(root,'cancel.db')),false);
  const midway=new AbortController();async function* rows(){yield ['kept'];midway.abort();yield ['cancelled'];}
  await assert.rejects(writeStreamingXlsx(root,[{name:'Cancelled',headers:['text'],rows:rows()}],midway.signal),/abort/i);
});


test('streamed workbook rejects missing worksheets and output-file failures', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-xlsx-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  async function* first() { yield ['first']; }
  async function* second() {
    fs.unlinkSync(path.join(root, 'sheet1.xml'));
    yield ['second'];
  }
  await assert.rejects(writeStreamingXlsx(root, [
    { name: 'First', headers: ['text'], rows: first() },
    { name: 'Second', headers: ['text'], rows: second() }
  ]), /ENOENT/);
  const outputFailure = path.join(root, 'output-failure');
  fs.mkdirSync(outputFailure);
  fs.writeFileSync(path.join(outputFailure, 'export.xlsx'), 'previous file');
  await assert.rejects(writeStreamingXlsx(outputFailure, [
    { name: 'Cards', headers: ['text'], rows: first() }
  ]), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(outputFailure, 'export.xlsx'), 'utf8'), 'previous file');
});
