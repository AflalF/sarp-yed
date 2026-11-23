const {chromium}=require('playwright');const fs=require('fs');
const URL='http://localhost:8765/SARP_YED_Data_Capture.html' /* serve ../../capture-form with: python3 -m http.server 8765 */,O=__dirname+'/out/';
const recs=JSON.parse(fs.readFileSync(O+'recs.json','utf8'));
const res=[];const ok=(id,n,c,d='')=>{res.push({id,name:n,result:c?'PASS':'FAIL',detail:c?'':String(d)});console.log(id,c?'PASS':'FAIL',n,c?'':String(d));};
const MOCK=()=>{window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory();return r.getDirectoryHandle('SARP_folder',{create:true});};};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true});await ctx.addInitScript(MOCK);const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('dialog',d=>d.accept());
const T=()=>p.textContent('#toast');
const folderFile=async(name,bin)=>p.evaluate(async([n,bin])=>{try{const r=await (await navigator.storage.getDirectory()).getDirectoryHandle('SARP_folder');const f=await (await r.getFileHandle(n)).getFile();if(bin){const u=new Uint8Array(await f.arrayBuffer());let s='';u.forEach(x=>s+=String.fromCharCode(x));return btoa(s);}return await f.text();}catch(e){return null;}},[name,bin]);
await p.goto(URL);await p.fill('#sCapturer','QA Capturer');await p.fill('#sDevice','L1');await p.fill('#sVenue','QA session');await p.click('#saveSetup');
ok('AS-01','Secure context available (file picker API present)',await p.evaluate(()=>!!window.showDirectoryPicker&&isSecureContext));
await p.click('nav button[data-tab=export]');await p.click('#pickDir');await p.waitForTimeout(400);
ok('AS-02','Choose folder before any record: confirms, no files written yet',(await T()).includes('Files appear after the first record'),await T());
ok('AS-03','Header shows auto-save on',(await p.textContent('#autoBadge')).includes('Auto-save on'),await p.textContent('#autoBadge'));
await p.click('nav button[data-tab=form]');
const sel=async(n,v)=>p.selectOption(`[name=${n}]`,v);
const fillRec=async(r)=>{
  await sel('district',r.district);
  if(r.dsMode==='other'){await sel('ds','__other__');await p.fill('[name=dsOther]',r.ds);}else await sel('ds',r.ds);
  if(r.gnMode==='other'){ if(r.dsMode!=='other') await sel('gn','__other__'); await p.fill('[name=gnNoManual]',r.gnNo);await p.fill('[name=gnNameManual]',r.gnName);}
  else await sel('gn','|'+r.gnName);
  for(const k of ['name','nic','address','business','mobile','whatsapp','email','landExtent','expYears','expText','finTotal','finOwn','finLoan','finSarp','resExText','resRqText','consentRef','remarks']) await p.fill(`[name=${k}]`,r[k]||'');
  await p.fill('[name=dob]',r.dob);
  for(const k of ['gender','lang','edu','type','bizReg']) await sel(k,r[k]||'');
  if(r.catMode==='other'){await sel('category','__other__');await p.fill('[name=categoryOther]',r.category);}else await sel('category',r.category);
  if(r.bizReg==='Yes'){await p.fill('[name=bizRegNo]',r.bizRegNo);await p.fill('[name=bizRegAuth]',r.bizRegAuth);}
  if(r.type==='Scale-up') for(const k of ['exName','exBrand','exInvest','exTurnover','exProfit','exYears']) await p.fill(`[name=${k}]`,r[k]);
  if(r.type==='Scale-up') await sel('exProfitable',r.exProfitable);
  for(const [kind,rows,keys] of [['ex',r.resEx,['item','qty','unit','cond','remarks']],['rq',r.resRq,['item','qty','unit','cost','priority','remarks']]]){
    for(let i=0;i<rows.length;i++){await p.click(`[data-addrow=${kind}]`);const ins=await p.$$(`#res${kind==='ex'?'Ex':'Rq'} tr:nth-child(${i+1}) [data-k]`);for(let j=0;j<keys.length;j++){const tag=await ins[j].evaluate(e=>e.tagName);if(tag==='SELECT')await ins[j].selectOption(rows[i][keys[j]]);else await ins[j].fill(rows[i][keys[j]]);}}}
  await p.check(`[name=consent][value=${r.consent}]`);await p.check(`[name=consultConsent][value=${r.consultConsent}]`);if(r.nicSeen)await p.check('[name=nicSeen]');
};
let saved=0,fails=[];const t0=Date.now();
for(let i=0;i<recs.length;i++){const r=recs[i];await fillRec(r);await p.click('button[type=submit]');const t=await T();if(t.includes('Saved: L1-'+String(i+1).padStart(3,'0')))saved++;else fails.push(`${i+1}: ${t}`);
  if(i===0){await p.waitForTimeout(500);const j=await folderFile('SARP_YED_autosave_L1.json');ok('AS-04','First save writes backup file to the folder',j&&JSON.parse(j).records.length===1,j&&j.slice(0,80));const x=await folderFile('SARP_YED_capture_L1_latest.xlsx',true);ok('AS-05','First save writes Excel file to the folder',!!x);}
  if(i===1){await p.waitForTimeout(500);const pv=await folderFile('SARP_YED_autosave_L1_previous.json');ok('AS-06','Previous backup kept as _previous.json',pv&&JSON.parse(pv).records.length===1);}
}
const secs=Math.round((Date.now()-t0)/1000);
ok('QA-01',`85 applicants entered one by one through the form (${secs}s)`,saved===85,fails.slice(0,5).join(' | '));
ok('QA-02','Header counter shows 85 / 85',(await p.textContent('#cnt')).startsWith('85 / 85'),await p.textContent('#cnt'));
await p.waitForTimeout(800);
const j85=await folderFile('SARP_YED_autosave_L1.json');ok('AS-07','Folder backup holds all 85 after the last save',j85&&JSON.parse(j85).records.length===85);
fs.writeFileSync(O+'folder_backup.json',j85||'');
const x85=await folderFile('SARP_YED_capture_L1_latest.xlsx',true);fs.writeFileSync(O+'folder_latest.xlsx',Buffer.from(x85||'','base64'));
ok('AS-08','Backup warning cleared because folder backup is current',await p.isHidden('#backupWarn'));
// reload persistence
await p.reload();await p.waitForTimeout(500);ok('QA-03','All 85 records still there after closing and reopening',(await p.textContent('#cnt')).startsWith('85 / 85'));
ok('AS-09','After reopening, a banner asks to pick the save folder again',await p.isVisible('#dirWarn')&&(await p.textContent('#dirWarnTxt')).includes('SARP_folder'),await p.textContent('#dirWarnTxt'));
await p.click('#reDir2');await p.waitForTimeout(600);ok('AS-09b','One click re-picks the folder and auto-save resumes',(await p.textContent('#autoBadge')).includes('Auto-saved')&&await p.isHidden('#dirWarn'),await p.textContent('#autoBadge'));
// edit -> autosave
await p.click('nav button[data-tab=list]');await (await p.$$('[data-edit]'))[4].click();await p.fill('[name=remarks]','Edited in QA');await p.click('button[type=submit]');await p.waitForTimeout(700);
let jj=JSON.parse(await folderFile('SARP_YED_autosave_L1.json'));ok('AS-10','Edit is written to the folder automatically',jj.records.find(r=>r.ref==='L1-005').remarks==='Edited in QA');
// delete -> autosave
await p.click('nav button[data-tab=list]');await p.fill('#search','L1-085');await (await p.$$('[data-del]'))[0].click();await p.click('#mYes');await p.waitForTimeout(700);
jj=JSON.parse(await folderFile('SARP_YED_autosave_L1.json'));ok('AS-11','Delete is written to the folder automatically (84 left)',jj.records.length===84,jj.records.length);
// export via button
await p.click('nav button[data-tab=export]');const [d]=await Promise.all([p.waitForEvent('download'),p.click('#expXlsx')]);await d.saveAs(O+'export_84.xlsx');
// permission loss
await p.evaluate(()=>{dirHandle.queryPermission=async()=>'prompt';});await p.click('nav button[data-tab=list]');await p.fill('#search','');await (await p.$$('[data-edit]'))[0].click();await p.fill('[name=remarks]','after permission lost');await p.click('button[type=submit]');await p.waitForTimeout(500);
ok('AS-12','If folder permission is lost, a Reconnect banner appears',await p.isVisible('#dirWarn'));
await p.evaluate(()=>{delete dirHandle.queryPermission;});await p.click('#reDir2');await p.waitForTimeout(600);
jj=JSON.parse(await folderFile('SARP_YED_autosave_L1.json'));ok('AS-13','Reconnect writes the missed change',jj.records.find(r=>r.ref==='L1-001').remarks==='after permission lost'&&await p.isHidden('#dirWarn'));
// wipe keeps folder file
await p.click('nav button[data-tab=export]');await p.click('#wipe');await p.click('#mYes');await p.waitForTimeout(500);
jj=JSON.parse(await folderFile('SARP_YED_autosave_L1.json'));ok('AS-14','Deleting records from the device does not empty the folder backup',(await p.textContent('#cnt')).startsWith('0 /')&&jj.records.length===84);
// restore from folder backup
fs.writeFileSync(O+'restore.json',JSON.stringify(jj));await p.setInputFiles('#impJson',O+'restore.json');await p.waitForTimeout(500);
ok('AS-15','Restore from the folder backup brings back all records',(await p.textContent('#cnt')).startsWith('84 /'),await p.textContent('#cnt'));
ok('QA-04','No JavaScript errors during the run',errs.length===0,errs.slice(0,3).join(';'));
fs.writeFileSync(O+'run85_results.json',JSON.stringify(res,null,1));res.forEach(r=>console.log(r.id,r.result,r.name,r.detail));await b.close();})();
