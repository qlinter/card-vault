const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { pipeline } = require('node:stream/promises');
const { DatabaseSync } = require('node:sqlite');
const ExcelJS = require('exceljs');
const { createMemorySampler } = require('./test-memory-sampler');
const { initializeTestDatabase, fileDatabaseUrl, findAvailablePort, startTestServer, waitForServer, stopServer, removeTempRoot } = require('./test-http-flow-utils');

// Native HTTP streams avoid an Undici paused-parser assertion in the bundled
// Node runtime when a large, backpressured response closes its connection.
function downloadResponse(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { agent: false, signal: AbortSignal.timeout(600000) }, resolve);
    request.once('error', reject);
  });
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-export-flow-'));
  const data = path.join(root,'data'), dbPath = path.join(data,'dev.db'), temporary = path.join(root,'jobs');
  fs.mkdirSync(temporary);
  const sampler = createMemorySampler(root, 100);
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(dbPath), TEMP: temporary, TMP: temporary, NODE_ENV: 'production' };
  const output=[], results=[];let db, server;
  const jobs=()=>fs.readdirSync(temporary).filter(name=>name.startsWith('card-vault-export-'));
  async function cleaned() { for(let n=0;n<200;n++){if(!jobs().length)return;await new Promise(resolve=>setTimeout(resolve,50));} assert.deepEqual(jobs(),[],'temporary export files should be removed'); }
  try {
    initializeTestDatabase(env);db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON');
    const port=await findAvailablePort(3380), base=`http://127.0.0.1:${port}`;
    server=startTestServer(port,{ ...env, ...sampler.env },output);await waitForServer(base,output,server,'Streaming export');
    const insert=db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,notes,visibility) VALUES(?,'Streaming fixture',?,'Basketball',?,?)");
    const quote=db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,10001,'CNY','2026-01-01T00:00:00.000Z','个人估计','fixture')");
    const count=process.argv.includes('--benchmark')?[1000,10000]:[600];let seeded=0;
    for(const size of count){
      db.exec('BEGIN');
      for(;seeded<size;seeded++){
        const id=`stream-${String(seeded).padStart(6,'0')}`;
        insert.run(id,`Card ${seeded}`,'私密 notes & <tag> '.repeat(120),seeded%2?'private':'public');
        for(let n=0;n<38;n++)quote.run(`${id}-v${String(n).padStart(3,'0')}`,id);
      }
      db.exec('COMMIT');
      for(const format of ['csv','xlsx']){
        const baseline = (await sampler.reset()).rss;
        const start=performance.now();
        const response = await downloadResponse(`${base}/api/data-center?export=${format}`);
        assert.equal(response.statusCode, 200, 'export download status');
        const readyMs=Math.round(performance.now()-start), destination=path.join(root,`download.${format}`);
        await pipeline(response,fs.createWriteStream(destination));
        assert.equal(fs.statSync(destination).size,Number(response.headers['content-length']));
        const elapsedMs=Math.round(performance.now()-start);
        const memory = sampler.read();
        await cleaned();
        if(format==='csv'){
          let lines=0;for await(const chunk of fs.createReadStream(destination))for(const value of chunk)if(value===10)lines++;
          assert.equal(lines,size);
        }else{
          const counts={};const book=new ExcelJS.stream.xlsx.WorkbookReader(destination);
          for await(const sheet of book){let rows=0;for await(const row of sheet){assert.ok(row.number>0);rows++;}counts[sheet.name]=rows;}
          assert.deepEqual(counts,{'Cards':size+1,'Financial history':size*38+1});
        }
        const result={cards:size,ledgerRows:size*38,format,readyMs,totalMs:elapsedMs,bytes:fs.statSync(destination).size,baselineRssMb:Math.round(baseline/1048576),peakRssMb:Math.round(memory.peak/1048576)};
        results.push(result);console.log(JSON.stringify(result));
      }
    }
    // Two concurrent generators fill the budget; a third request must fail cleanly.
    const controllers = [new AbortController(), new AbortController()];
    const requests = controllers.map(controller => {
      const pending = fetch(base + '/api/data-center?export=xlsx', { signal: controller.signal });
      void pending.catch(() => {});
      return pending;
    });
    try {
      for (let n = 0; n < 200 && jobs().length < 2; n++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(jobs().length, 2);
      const rejected = await fetch(base + '/api/data-center?export=csv');
      assert.equal(rejected.status, 400);
      assert.match((await rejected.json()).error, /两个导出/);
    } finally {
      controllers.forEach(controller => controller.abort());
      await Promise.allSettled(requests);
    }
    await cleaned();
    // Cancel both generation and an already-started download; future exports still work.
    const controller=new AbortController();
    const pending=fetch(`${base}/api/data-center?export=xlsx`,{signal:controller.signal});void pending.catch(()=>{});
    for(let n=0;n<100&&!jobs().length;n++)await new Promise(resolve=>setTimeout(resolve,10));
    controller.abort();await assert.rejects(pending);await cleaned();
    const response=await fetch(`${base}/api/data-center?export=csv`);assert.equal(response.status,200);
    const reader=response.body.getReader();await reader.read();await reader.cancel();await cleaned();
    const publicResponse=await fetch(`${base}/api/data-center?export=xlsx&publicOnly=true&q=Card%200`);
    assert.equal(publicResponse.status,200);
    const publicBook=new ExcelJS.Workbook();await publicBook.xlsx.load(Buffer.from(await publicResponse.arrayBuffer()));
    assert.equal(publicBook.worksheets.length,1);assert.equal(publicBook.worksheets[0].rowCount,2);
    assert.ok(!publicBook.worksheets[0].getRow(1).values.includes("notes"));await cleaned();
    console.log('Streaming export HTTP passed: complete rows, file sizes, cancellation and temporary cleanup.');
    fs.mkdirSync('logs',{recursive:true});fs.writeFileSync(process.argv.includes('--benchmark') ? 'logs/v132-streaming-export-benchmark.json' : 'logs/v132-streaming-export-test.json',JSON.stringify({node:process.version,samplingMs:100,results},null,2));
  }catch(error){console.error(output.join(''));throw error;}
  finally{db?.close();stopServer(server);await removeTempRoot(root);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
