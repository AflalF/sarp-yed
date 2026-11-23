const {chromium}=require('playwright');const fs=require('fs');
const BASE='http://localhost:8766/sarp-yed/';const OUT=__dirname+'/out/';fs.mkdirSync(OUT,{recursive:true});
const res=[];const ok=(id,area,n,c,d='')=>{res.push({id,area,name:n,result:c?'PASS':'FAIL',detail:c?'':String(d)});console.log(id,c?'PASS':'FAIL',n,c?'':String(d));};
(async()=>{const b=await chromium.launch();
const newPage=async(vp={width:1366,height:900})=>{const ctx=await b.newContext({viewport:vp,acceptDownloads:true});const p=await ctx.newPage();p.errs=[];p.ext=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});p.on('dialog',d=>d.accept());p.on('request',r=>{const u=r.url();if(!u.startsWith('http://localhost:8766')&&!u.startsWith('data:')&&!u.startsWith('blob:'))p.ext.push(u)});return p;};
let p=await newPage();
// ---- site structure
let r=await p.goto(BASE);ok('S-01','Site','Main page loads (HTTP 200) and is the demo',r.status()===200&&(await p.title())==='SARP YED Demo',r.status()+' '+await p.title());
for(const [id,path,title] of [['S-02','demo/sarp-yed-demo.html','SARP YED Demo'],['S-03','capture-form/SARP_YED_Data_Capture.html','SARP YED: Applicant Data Capture (v2)']]){const q=await newPage();const rr=await q.goto(BASE+path);ok(id,'Site',`Old address still works: /${path}`,rr.status()===200&&(await q.title())===title,rr.status());await q.context().close();}
const nf=await p.request.get(BASE+'nope.html');ok('S-04','Site','Unknown address returns 404 (no accidental files)',nf.status()===404,nf.status());
const roles={FO:true,ST:true,MG:true,AD:true,FL:false,RV:false,SL:false,GO:false,PMU:false};let bad=[];
for(const [k,v] of Object.entries(roles)){await p.selectOption('#roleSel',k);await p.waitForTimeout(60);const has=(await p.locator('[data-nav="capture"]').count())>0;if(has!==v)bad.push(k);}
ok('S-05','Navigation','"Data capture form" menu item shows for FO, ST, MG, AD only',bad.length===0,bad.join(','));
await p.selectOption('#roleSel','FO');await p.click('[data-nav="capture"]');await p.waitForTimeout(900);
let f=p.frame({url:/SARP_YED_Data_Capture/});ok('S-06','Embedded form','Form loads inside the demo (iframe, same site)',!!f&&(await f.title()).includes('Applicant Data Capture'));
const href=await p.getAttribute('a:has-text("Open full screen")','href');const full=await p.request.get(new URL(href,p.url()).href);ok('S-07','Embedded form','"Open full screen" link resolves (HTTP 200)',full.status()===200,href+' '+full.status());
const dl=await p.getAttribute('a:has-text("Download for offline use")','href');const dlr=await p.request.get(new URL(dl,p.url()).href);const same=(await dlr.body()).equals(fs.readFileSync(require('path').resolve(__dirname,'../../capture-form/SARP_YED_Data_Capture.html')));ok('S-08','Embedded form','"Download for offline use" gives the exact form file',dlr.status()===200&&same,dlr.status());
ok('S-09','Embedded form','Online-copy note shows inside the demo, with a working download link',await f.isVisible('#onlineNote')&&(await p.request.get(new URL(await f.getAttribute('#dlSelf','href'),f.url()).href)).status()===200);
// ---- end to end: capture in embedded form -> backup -> import in demo
await f.fill('#sCapturer','QA Capturer');await f.fill('#sDevice','W1');await f.selectOption('#sDist','Vavuniya');await f.selectOption('#sDS','Vavuniya South');await f.click('#saveSetup');await p.waitForTimeout(200);
ok('S-10','Embedded form','Session setup works inside the demo; location pre-filled',await f.inputValue('[name=ds]')==='Vavuniya South');
const people=[['Embedded One','200012345678','0771112221'],['Embedded Two','199935012345','0762223332'],['Embedded Three','199812300456','0753334443']];
for(const [n,nic,mob] of people){await f.selectOption('[name=gn]',{index:2});await f.fill('[name=gnNumber]','214');await f.fill('[name=name]',n);await f.fill('[name=nic]',nic);await f.selectOption('[name=gender]','Female');await f.selectOption('[name=lang]','Tamil');await f.fill('[name=mobile]',mob);await f.fill('[name=address]','1 Lake Rd');await f.fill('[name=business]','Mushroom unit');await f.selectOption('[name=category]','Mushroom production');await f.selectOption('[name=type]','Start-up');await f.check('[name=consent][value=Yes]');await f.check('[name=consultConsent][value=Yes]');await f.check('[name=nicSeen]');await f.click('button[type=submit]');await p.waitForTimeout(150);}
ok('S-11','Embedded form','3 applicants saved one by one inside the demo',(await f.textContent('#cnt')).startsWith('3 / 85'),await f.textContent('#cnt'));
await f.click('nav button[data-tab=export]');
let [d]=await Promise.all([p.waitForEvent('download'),f.click('#expXlsx')]);await d.saveAs(OUT+'embedded.xlsx');ok('S-12','Embedded form','Excel download works from inside the demo',fs.statSync(OUT+'embedded.xlsx').size>2000);
[d]=await Promise.all([p.waitForEvent('download'),(async()=>{await f.click('#expEnc');await f.fill('#pw1','Sarp-2026!x');await f.fill('#pw2','Sarp-2026!x');await f.click('#mYes');})()]);await d.saveAs(OUT+'embedded_protected.json');
ok('S-13','Embedded form','Password-protected backup works from inside the demo',JSON.parse(fs.readFileSync(OUT+'embedded_protected.json','utf8')).enc!==undefined);
await p.selectOption('#roleSel','AD');await p.click('[data-nav="import"]');await p.setInputFiles('#impFile',OUT+'embedded_protected.json');await p.waitForTimeout(200);await p.fill('#pw','Sarp-2026!x');await p.click('#mok');await p.waitForTimeout(900);
const prev=await p.textContent('#impPreview');ok('S-14','End to end','Demo import opens the protected backup and previews 3 records',/3 records/.test(prev),prev.slice(0,120));
const before=await p.evaluate(()=>DB.apps.length);await p.click('#impGo');await p.click('#keyBtn');await p.waitForTimeout(800);
const imp=await p.evaluate(n=>DB.apps.slice(n),before);ok('S-15','End to end','Captured applicants arrive in the system with capture refs W1-001..003',imp.length===3&&imp.map(a=>a.captureRef).join()==='W1-001,W1-002,W1-003'&&imp.every(a=>a.gnNo==='214'),JSON.stringify(imp.map(a=>[a.captureRef,a.status,a.gnNo])));
await p.selectOption('#roleSel','MG');await p.evaluate(id=>{ui.view='app';ui.app=id;ui.tab='overview';render();},imp[0].rec);const ov=await p.textContent('main');
ok('S-16','End to end','Imported record shows capture reference, GN number and consultancy answer',/W1-001/.test(ov)&&/214 – /.test(ov)&&/consultancy ✓ Yes/.test(ov));
ok('S-17','Quality','No JavaScript errors in the whole session',p.errs.length===0,p.errs.slice(0,3).join(';'));
ok('S-18','Quality','No requests to outside websites (works offline, nothing leaks)',p.ext.length===0,p.ext.slice(0,3).join(','));
// ---- mobile
const m=await newPage({width:390,height:844});await m.goto(BASE);await m.selectOption('#roleSel','FO');await m.click('[data-nav="capture"]');await m.waitForTimeout(800);
const mo=await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);const mf=m.frame({url:/SARP_YED_Data_Capture/});const mfo=mf?await mf.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1):false;
ok('S-19','Mobile','Phone width (390 px): demo and embedded form fit without sideways scrolling',mo&&mfo,`demo ${mo} form ${mfo}`);await m.screenshot({path:OUT+'mobile_capture.png'});
// ---- sizes
const sz=['index.html','demo/sarp-yed-demo.html','capture-form/SARP_YED_Data_Capture.html'].map(x=>fs.statSync(require('path').resolve(__dirname,'../../'+x)).size);
ok('S-20','Quality',`Page sizes reasonable (main ${Math.round(sz[0]/1024)} KB, form ${Math.round(sz[2]/1024)} KB)`,sz.every(x=>x<1.5e6));
// ---- timing
const t=await newPage();const t0=Date.now();await t.goto(BASE,{waitUntil:'load'});const lt=Date.now()-t0;ok('S-21','Quality',`Main page loads quickly (${lt} ms locally)`,lt<3000,lt);
fs.writeFileSync(OUT+'site_results.json',JSON.stringify(res,null,1));console.log(res.filter(r=>r.result=='PASS').length+'/'+res.length);await b.close();})();
