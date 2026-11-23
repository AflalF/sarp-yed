const {chromium}=require('playwright');const fs=require('fs');
const URL='file://'+require('path').resolve(__dirname,'../../capture-form/SARP_YED_Data_Capture.html'),OUT=__dirname+'/out/';
const res=[];const ok=(n,c,d='')=>res.push([c?'PASS':'FAIL',n,c?'':String(d)]);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('dialog',d=>d.accept());
const T=async()=>await p.textContent('#toast');
await p.goto(URL);
ok('Opens on Session setup',await p.isVisible('#tab-setup'));
await p.fill('#sCapturer','Tester');await p.click('#saveSetup');ok('Device code is required',(await T()).includes('device code'));
await p.fill('#sDevice','l1');await p.fill('#sVenue','Vavuniya DS');await p.click('#saveSetup');ok('Setup saved with device code',await p.isVisible('#tab-form'));
const dists=await p.$$eval('[name=district] option',o=>o.map(x=>x.value).filter(Boolean));
ok('District list is the 6 districts',JSON.stringify(dists)===JSON.stringify(['Anuradhapura','Vavuniya','Mannar','Puttalam','Kurunegala','Matale']),dists);
ok('DS disabled until district chosen',await p.isDisabled('[name=ds]'));
await p.selectOption('[name=district]','Matale');let ds=await p.$$eval('[name=ds] option',o=>o.map(x=>x.value).filter(Boolean));ok('Matale shows 5 audit DS + Other',ds.length===6,ds.length);
await p.selectOption('[name=district]','Anuradhapura');ds=await p.$$eval('[name=ds] option',o=>o.map(x=>x.value).filter(Boolean));ok('Anuradhapura shows 15 audit DS + Other',ds.length===16,ds.length);
await p.selectOption('[name=district]','Kurunegala');ds=await p.$$eval('[name=ds] option',o=>o.map(x=>x.value).filter(Boolean));ok('Kurunegala shows 25 audit DS + Other',ds.length===26,ds.length);
await p.selectOption('[name=district]','Vavuniya');await p.selectOption('[name=ds]','Vavuniya South');
await p.selectOption('[name=gn]','__other__');ok('GN Other: manual GN number and name shown',await p.isVisible('[name=gnNoManual]')&&await p.isVisible('#gnManNote'));
// required-only record
const fillReq=async(o)=>{for(const[k,v]of Object.entries(o)){const el=await p.$(`[name="${k}"]`);const t=await el.evaluate(e=>e.tagName+'|'+e.type);if(t.startsWith('SELECT'))await p.selectOption(`[name="${k}"]`,v);else if(t.endsWith('radio'))await p.check(`[name="${k}"][value="${v}"]`);else if(t.endsWith('checkbox')){if(v)await p.check(`[name="${k}"]`);}else await p.fill(`[name="${k}"]`,v);}};
await fillReq({name:'Req Only',nic:'200012345678'});
ok('DOB auto-filled from NIC',await p.inputValue('[name=dob]')==='2000-05-02');
ok('Gender NOT auto-filled from NIC',await p.inputValue('[name=gender]')==='');
ok('Age shown read-only beside DOB',(await p.inputValue('[name=ageShow]')).endsWith('years')&&await p.$eval('[name=ageShow]',e=>e.readOnly));
await fillReq({gender:'Male',lang:'Tamil',mobile:'0771234567',address:'1 Main St',business:'Dairy',category:'Livestock',type:'Start-up',consent:'Yes',nicSeen:true});
await p.click('button[type=submit]');ok('Blocked without GN and consultancy answer',(await T()).includes('required'),await T());
ok('Consultancy consent marked',(await p.textContent('[data-err=consultConsent]')).includes('Choose'));
ok('Manual GN name marked red',await p.$eval('[name=gnNameManual]',e=>e.classList.contains('bad')));
await fillReq({gnNoManual:'214',gnNameManual:'Nedunkulam',consultConsent:'No'});await p.click('button[type=submit]');
const t1=await T();ok('Saves with only required fields; consultancy No allowed (edu, land, experience optional)',t1.includes('Saved: L1-001'),t1);
ok('Typed GN flagged for checking',t1.includes('flagged'));
ok('District and DS kept for next entry',await p.inputValue('[name=district]')==='Vavuniya'&&await p.inputValue('[name=ds]')==='Vavuniya South');
// GN list load
await p.click('nav button[data-tab=setup]');await p.setInputFiles('#gnFile',__dirname+'/out/gn_list.xlsx');await p.waitForTimeout(500);
ok('GN list loads from Excel (GN number optional, so 6 rows load)',(await T()).includes('Loaded 6'),await T());

await p.setInputFiles('#gnFile',OUT+'gn_list.csv');await p.waitForTimeout(300);ok('GN list loads from CSV (quoted comma)',(await T()).includes('Loaded 1'),await T());
await p.setInputFiles('#gnFile',__dirname+'/out/gn_list.xlsx');await p.waitForTimeout(400);
await p.click('nav button[data-tab=form]');await p.selectOption('[name=ds]','Vavuniya South');
const gns=await p.$$eval('[name=gn] option',o=>o.map(x=>x.textContent).filter(Boolean));
ok('GN dropdown shows only listed GN for the DS, plus Other',JSON.stringify(gns)===JSON.stringify(['214 – Nedunkulam','215 – Poovarasankulam','Other (type)']),gns);
ok('Manual GN hidden when list loaded',!(await p.isVisible('[name=gnNoManual]')));
await p.selectOption('[name=ds]','__other__');ok('DS Other falls back to typed GN',await p.isVisible('[name=gnNameManual]'));
await p.selectOption('[name=ds]','Vavuniya South');
// full record with new sections
await fillReq({gn:'215|Poovarasankulam',name:'Full Record',nic:'199935012345',gender:'Female',lang:'Tamil',mobile:'0762222222',address:'2 Lake Rd',business:'Greenhouse chillies',category:'Protected agriculture',type:'Scale-up',consent:'Yes',consultConsent:'Yes',nicSeen:true});
ok('Scale-up section shown',await p.isVisible('#scaleCard'));
await p.selectOption('[name=bizReg]','Yes');ok('Registration number and authority shown when Yes',await p.isVisible('[name=bizRegNo]')&&await p.isVisible('[name=bizRegAuth]'));
await fillReq({resExText:'2 cows and a shed, dug well',resRqText:'Polytunnel 20 x 8 m, drip kit',exBrand:'Lake Fresh',finTotal:'2,000,000',finOwn:'300000',finLoan:'700000',finSarp:'950000'});
await p.click('[data-addrow=ex]');await p.click('[data-addrow=ex]');await p.click('[data-addrow=ex]');
let rows=await p.$$('#resEx tr');ok('Add rows to existing resources',rows.length===3);
const fillRow=async(sel,i,vals)=>{const ins=await p.$$(`${sel} tr:nth-child(${i}) [data-k]`);for(let j=0;j<vals.length;j++){if(vals[j]===null)continue;const tag=await ins[j].evaluate(e=>e.tagName);if(tag==='SELECT')await ins[j].selectOption(vals[j]);else await ins[j].fill(vals[j]);}};
await fillRow('#resEx',1,['Water pump','1','Nos','Good','2 HP']);await fillRow('#resEx',2,['Land','abc','acres','','']);
await p.click('#resEx tr:nth-child(3) [data-delrow]');ok('Delete a resource row',(await p.$$('#resEx tr')).length===2);
await p.click('[data-addrow=rq]');await p.click('[data-addrow=rq]');
await fillRow('#resRq',1,['Polytunnel','1','Nos','1,200,000','High','']);await fillRow('#resRq',2,['Drip kit','2','set','150000','Medium','']);
ok('Required resources total shown',(await p.textContent('#rqTotal')).includes('1,350,000'),await p.textContent('#rqTotal'));
await p.click('button[type=submit]');ok('Bad resource quantity blocks save',(await p.textContent('#resExErr')).includes('row 2'),await p.textContent('#resExErr'));
await fillRow('#resEx',2,['Land','0.5','acres','Owned','']);
const fl=await p.textContent('#flags');ok('Financial plan mismatch flagged',fl.includes('own + loan + SARP'));ok('SARP above LKR 900,000 flagged',fl.includes('900,000'));ok('Registered but no number flagged',fl.includes('registration number'));
await p.click('button[type=submit]');ok('Full record saves (flagged)',(await T()).includes('Saved: L1-002'),await T());
// list + edit
await p.click('nav button[data-tab=list]');ok('List shows GN',(await p.textContent('#rows')).includes('215 – Poovarasankulam'));
// backup -> edit -> backup required again
await p.click('nav button[data-tab=export]');
let [d]=await Promise.all([p.waitForEvent('download'),(async()=>{await p.click('#expJson');await p.click('#mYes');})()]);await d.saveAs(OUT+'b_plain.json');
ok('Plain backup warns and downloads',fs.existsSync(OUT+'b_plain.json'));
await p.click('nav button[data-tab=list]');await p.click('[data-edit]');
await p.click('nav button[data-tab=list]');const edits=await p.$$('[data-edit]');await edits[1].click();
ok('Edit restores GN dropdown and resource rows',await p.inputValue('[name=gn]')==='215|Poovarasankulam'&&(await p.$$('#resRq tr')).length===2);
ok('Edit restores resource descriptions',await p.inputValue('[name=resExText]')==='2 cows and a shed, dug well'&&await p.inputValue('[name=resRqText]')==='Polytunnel 20 x 8 m, drip kit');
await p.fill('[name=remarks]','edited');await p.click('button[type=submit]');ok('Edit asks for new backup',(await T()).includes('new backup'));
await p.click('nav button[data-tab=export]');ok('Export page shows changes since backup',(await p.textContent('#lastExp')).includes('Changes since last backup'));
await p.click('#wipe');ok('Wipe refused after edit until new backup',(await T()).includes('backup'));
// encrypted backup
[d]=await Promise.all([p.waitForEvent('download'),(async()=>{await p.click('#expEnc');await p.fill('#pw1','short');await p.fill('#pw2','short');await p.click('#mYes');ok('Short password refused',(await p.textContent('#pwErr')).includes('8'));await p.fill('#pw1','Sarp-2026!x');await p.fill('#pw2','Sarp-2026!x');await p.click('#mYes');})()]);await d.saveAs(OUT+'b_enc.json');
const encTxt=fs.readFileSync(OUT+'b_enc.json','utf8');ok('Protected backup has no readable NIC or names',!encTxt.includes('199935012345')&&!encTxt.includes('Full Record')&&encTxt.includes('"enc"'));
// excel
[d]=await Promise.all([p.waitForEvent('download'),p.click('#expXlsx')]);await d.saveAs(OUT+'v2.xlsx');
// second device
const c2=await b.newContext({acceptDownloads:true});const q=await c2.newPage();q.on('pageerror',e=>errs.push(e.message));q.on('dialog',d=>d.accept());await q.goto(URL);await q.fill('#sCapturer','Second');await q.fill('#sDevice','L2');await q.click('#saveSetup');
await q.click('nav button[data-tab=export]');await q.setInputFiles('#impJson',OUT+'b_enc.json');await q.fill('#pw1','wrong-password');await q.click('#mYes');await q.waitForTimeout(800);
ok('Wrong password refused',(await q.textContent('#toast')).includes('Wrong password'),await q.textContent('#toast'));
await q.setInputFiles('#impJson',OUT+'b_enc.json');await q.fill('#pw1','Sarp-2026!x');await q.click('#mYes');await q.waitForTimeout(800);
ok('Protected backup restores on second device',(await q.textContent('#toast')).includes('Imported 2 new'),await q.textContent('#toast'));
await q.click('nav button[data-tab=list]');ok('Capture refs preserved on import',(await q.textContent('#rows')).includes('L1-001')&&(await q.textContent('#rows')).includes('L1-002'));
await q.click('nav button[data-tab=export]');await q.setInputFiles('#impJson',OUT+'b_plain.json');await q.waitForTimeout(400);
ok('Older backup does not overwrite newer edits',(await q.textContent('#toast')).includes('2 already up to date'),await q.textContent('#toast'));
// L2 edits a record, L1 imports -> update
await q.click('nav button[data-tab=list]');await (await q.$$('[data-edit]'))[0].click();await q.fill('[name=remarks]','fixed by L2');await q.click('button[type=submit]');
await q.click('nav button[data-tab=export]');let [d2]=await Promise.all([q.waitForEvent('download'),(async()=>{await q.click('#expJson');await q.click('#mYes');})()]);await d2.saveAs(OUT+'b_l2.json');
await p.setInputFiles('#impJson',OUT+'b_l2.json');await p.waitForTimeout(400);ok('Newer edit from other device merges as update',(await T()).includes('updated 1'),await T());
// same NIC different record
await q.click('nav button[data-tab=form]');await q.selectOption('[name=district]','Mannar');await q.selectOption('[name=ds]','Madhu');
// v1 migration
const c3=await b.newContext({acceptDownloads:true});const m=await c3.newPage();m.on('pageerror',e=>errs.push(e.message));m.on('dialog',d=>d.accept());
await m.goto(URL);await m.evaluate(()=>{localStorage.setItem('sarp-yed-capture-v1',JSON.stringify({records:[{id:'L1-old',ref:'L1-001',nic:'200012345678',name:'Old',dob:'2000-05-02',gn:'Old GN text',aiConsent:'Yes',status:'Complete',flags:[],capturedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),district:'Vavuniya',ds:'Vavuniya'}],seq:1}));localStorage.setItem('sarp-yed-capture-setup-v1',JSON.stringify({capturer:'Old user',device:'L1',target:85}));});
await m.reload();await m.click('nav button[data-tab=list]');const lt=await m.textContent('#rows');
const [d3]=await Promise.all([m.waitForEvent('download'),(async()=>{await m.click('nav button[data-tab=export]');await m.click('#expJson');await m.click('#mYes');})()]);const mig=JSON.parse(fs.readFileSync(await d3.path(),'utf8')).records[0];
ok('Version-1 records migrate: old consent removed, flagged, GN kept',lt.includes('Needs check')&&lt.includes('Old GN text')&&!('aiConsent' in mig)&&mig.consultConsent===''&&mig.flags.some(f=>f.includes('consultancy')),JSON.stringify(mig));
ok('Old setup (name, device) carried over',await m.evaluate(()=>!document.querySelector('#tab-setup').classList.contains('hide'))===false);
// no AI wording anywhere
const html=fs.readFileSync(require('path').resolve(__dirname,'../../capture-form/SARP_YED_Data_Capture.html'),'utf8');ok('No applicant-facing AI wording',!/\bAI\b|artificial/i.test(html.replace(/aiConsent/g,'')));
// mobile
const mp=await b.newPage({viewport:{width:390,height:844}});await mp.goto(URL);ok('No horizontal scroll on phone (page)',await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
ok('No JavaScript errors',errs.length===0,errs.join(';'));
fs.writeFileSync(OUT+'results2.json',JSON.stringify(res,null,1));res.forEach(r=>console.log(r.join(' | ')));console.log(res.filter(r=>r[0]=='PASS').length+'/'+res.length);await b.close();})();
