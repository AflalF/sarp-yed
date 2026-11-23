const {chromium}=require('playwright');const fs=require('fs');
const URL='file://'+require('path').resolve(__dirname,'../../capture-form/SARP_YED_Data_Capture.html'),OUT=__dirname+'/out/';
const res=[];const ok=(n,c,d='')=>res.push([c?'PASS':'FAIL',n,c?'':String(d)]);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('dialog',d=>d.accept());
const T=async()=>await p.textContent('#toast');
const opts=async(n)=>await p.$$eval(`[name=${n}] option`,o=>o.map(x=>x.textContent).filter(Boolean));
await p.goto(URL);await p.fill('#sCapturer','Tester');await p.fill('#sDevice','L1');
ok('Built-in audit list shown in setup',(await p.textContent('#gnStatus')).includes('1604 GN divisions')&&(await p.textContent('#gnStatus')).includes('Anuradhapura 15 DS / 319 GN'),await p.textContent('#gnStatus'));
await p.click('#saveSetup');
const cnt={Anuradhapura:15,Kurunegala:25,Mannar:3,Matale:5,Puttalam:10,Vavuniya:3};
for(const[d,n]of Object.entries(cnt)){await p.selectOption('[name=district]',d);const o=await opts('ds');ok(`${d}: ${n} audit DS + Other`,o.length===n+1&&o[o.length-1]==='Other (type)',o.length);}
await p.selectOption('[name=district]','Mannar');ok('Mannar uses audit spelling Musalai / Nanaddan',(await opts('ds')).includes('Musalai')&&(await opts('ds')).includes('Nanaddan'));
await p.selectOption('[name=district]','Kurunegala');ok('Kurunegala has Panduwasnuwara East and West',(await opts('ds')).includes('Panduwasnuwara East')&&(await opts('ds')).includes('Panduwasnuwara West'));
await p.selectOption('[name=ds]','Maho');let g=await opts('gn');ok('Maho GN list de-duplicated (36 unique + Other)',g.length===new Set(g).size&&g.includes('Other (type)'),g.length);
await p.selectOption('[name=district]','Vavuniya');await p.selectOption('[name=ds]','Vavuniya South');g=await opts('gn');ok('Vavuniya South: 14 GN + Other',g.length===15,g.length);
ok('GN manual fields hidden while list GN chosen',!(await p.isVisible('[name=gnNameManual]')));
const fill=async(o)=>{for(const[k,v]of Object.entries(o)){const el=await p.$(`[name="${k}"]`);const t=await el.evaluate(e=>e.tagName+'|'+e.type);if(t.startsWith('SELECT'))await p.selectOption(`[name="${k}"]`,v);else if(t.endsWith('radio'))await p.check(`[name="${k}"][value="${v}"]`);else if(t.endsWith('checkbox')){if(v)await p.check(`[name="${k}"]`);}else await p.fill(`[name="${k}"]`,v);}};
const base={name:'List Person',nic:'200012345678',gender:'Male',lang:'Tamil',mobile:'0771234567',address:'1 Main',business:'Dairy',category:'Livestock',type:'Start-up',consent:'Yes',consultConsent:'Yes',nicSeen:true};
await p.selectOption('[name=gn]',{index:1});
const gv=await p.inputValue('[name=gn]');
await fill(base);await p.click('button[type=submit]');let t=await T();ok('Record with audit DS and GN saves without flag',t.includes('Saved: L1-001')&&!t.includes('flagged'),t+' gn='+gv);
// GN other
await fill({...base,name:'GN Other',nic:'199935012345',mobile:'0762222222'});await p.selectOption('[name=gn]','__other__');
ok('GN Other shows name (required) and number (optional)',await p.isVisible('[name=gnNameManual]')&&await p.isVisible('[name=gnNoManual]'));
await p.click('button[type=submit]');ok('GN Other blocks save without a name',(await T()).includes('required'));
await p.fill('[name=gnNameManual]','New Village');await p.click('button[type=submit]');t=await T();ok('GN Other saves and is flagged',t.includes('L1-002')&&t.includes('flagged'),t);
// DS other
await fill({...base,name:'DS Other',nic:'199812300456',mobile:'0753333333'});await p.selectOption('[name=ds]','__other__');
ok('DS Other shows DS text box; GN locked to typed',await p.isVisible('[name=dsOther]')&&await p.isVisible('[name=gnNameManual]')&&await p.isDisabled('[name=gn]'));
await p.click('button[type=submit]');ok('DS Other needs DS name and GN name',(await T()).includes('2 required')||(await T()).includes('required'),await T());
await p.fill('[name=dsOther]','Vavuniya North');await p.fill('[name=gnNameManual]','Nedunkerny');await p.click('button[type=submit]');t=await T();ok('DS Other saves, flagged',t.includes('L1-003')&&t.includes('flagged'),t);
ok('DS Other kept for next entry',await p.inputValue('[name=ds]')==='__other__'&&await p.inputValue('[name=dsOther]')==='Vavuniya North');
// category other + edu other
await p.selectOption('[name=ds]','Vavuniya');
await fill({...base,name:'Cat Other',nic:'199720100789',mobile:'0714444444'});await p.selectOption('[name=gn]',{index:1});
await p.selectOption('[name=category]','__other__');ok('Category Other shows text box',await p.isVisible('[name=categoryOther]'));
await p.click('button[type=submit]');ok('Category Other requires text',(await T()).includes('required'));
await p.fill('[name=categoryOther]','Spice processing');await p.selectOption('[name=edu]','__other__');await p.fill('[name=eduOther]','NVQ Level 4 Agriculture');await p.click('button[type=submit]');t=await T();ok('Category and education Other save',t.includes('L1-004'),t);
// edit restores Other values
await p.click('nav button[data-tab=list]');const ed=await p.$$('[data-edit]');
await ed[2].click();ok('Edit restores DS Other and typed GN',await p.inputValue('[name=ds]')==='__other__'&&await p.inputValue('[name=dsOther]')==='Vavuniya North'&&await p.inputValue('[name=gnNameManual]')==='Nedunkerny');
await p.click('#cancelEdit');await p.click('nav button[data-tab=list]');await (await p.$$('[data-edit]'))[3].click();
ok('Edit restores category and education Other',await p.inputValue('[name=category]')==='__other__'&&await p.inputValue('[name=categoryOther]')==='Spice processing'&&await p.inputValue('[name=eduOther]')==='NVQ Level 4 Agriculture');
await p.click('#cancelEdit');await p.click('nav button[data-tab=list]');await (await p.$$('[data-edit]'))[0].click();
ok('Edit restores audit GN selection',await p.inputValue('[name=gn]')===gv&&gv!=='',gv);
await p.click('#cancelEdit');
// excel
await p.click('nav button[data-tab=export]');const [d]=await Promise.all([p.waitForEvent('download'),p.click('#expXlsx')]);await d.saveAs(OUT+'v3.xlsx');
// load the user's audit workbook
await p.click('nav button[data-tab=setup]');await p.setInputFiles('#gnFile',__dirname+'/out/DS_GN_audit.xlsx' /* place the audit workbook here */);await p.waitForTimeout(800);
t=await T();ok('User audit workbook loads in its own layout (1604, 39 repeats ignored)',t.includes('Loaded 1604')&&t.includes('39 repeated'),t);
await p.setInputFiles('#gnFile',__dirname+'/out/gn_list.xlsx');await p.waitForTimeout(500);t=await T();ok('4-column list with GN numbers still loads',t.includes('Loaded'),t);
await p.click('nav button[data-tab=form]');await p.selectOption('[name=district]','Vavuniya');await p.selectOption('[name=ds]','Vavuniya South');ok('Numbered GN shown as number – name',(await opts('gn')).includes('214 – Nedunkulam'));
await p.click('nav button[data-tab=setup]');await p.click('#gnClear');await p.click('#mYes');ok('Back to built-in list',(await p.textContent('#gnStatus')).includes('built in'));
ok('No JavaScript errors',errs.length===0,errs.join(';'));
res.forEach(r=>console.log(r.join(' | ')));console.log(res.filter(r=>r[0]=='PASS').length+'/'+res.length);await b.close();})();
