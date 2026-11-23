import os
import json,openpyxl,warnings,datetime
warnings.filterwarnings('ignore')
recs=json.load(open('recs.json'))
wb=openpyxl.load_workbook('folder_latest.xlsx')
ws=wb['Applicants'];H=[c.value for c in ws[1]];rows=[dict(zip(H,r)) for r in ws.iter_rows(min_row=2,values_only=True)]
out={'checked':0,'mismatch':[]}
def num(v):
    v=str(v).replace(',','');f=float(v);return int(f) if f==int(f) else f
def norm_mob(m):
    m=m.replace(' ','')
    return m
M=[('district','District'),('ds','DS division'),('gnName','GN name'),('gnNo','GN number'),('name','Full name (as on NIC)'),('nic','NIC number'),('dob','Date of birth'),('gender','Gender'),('lang','Preferred language'),('edu','Education qualification'),('mobile','Mobile number'),('whatsapp','WhatsApp number'),('email','Email'),('address','Permanent address'),('business','Proposed agribusiness'),('category','Business category'),('type','Type of business'),('bizReg','Business registered'),('bizRegNo','Business registration number'),('bizRegAuth','Registering authority'),('landExtent','Land extent (acres)'),('expYears','Related experience (years)'),('expText','Related experience'),('exName','Existing business name'),('exBrand','Brand name'),('exInvest','Existing investment (LKR)'),('exTurnover','Annual turnover (LKR)'),('exProfit','Annual net profit (LKR)'),('exYears','Years in operation'),('exProfitable','Profitable'),('finTotal','Plan: total investment (LKR)'),('finOwn','Plan: own contribution (LKR)'),('finLoan','Plan: bank loan (LKR)'),('finSarp','Plan: SARP contribution (LKR)'),('resExText','Existing resources (description)'),('resRqText','Required resources (description)'),('consent','Data-use consent signed'),('consultConsent','Indo-Lanka consultancy consent'),('consentRef','Consent form ref'),('remarks','Remarks')]
NUM={'landExtent','expYears','exInvest','exTurnover','exProfit','exYears','finTotal','finOwn','finLoan','finSarp'}
assert len(rows)==85, len(rows)
for i,(r,x) in enumerate(zip(recs,rows)):
    ref=f"L1-{i+1:03d}"
    if x['Capture ref']!=ref: out['mismatch'].append((ref,'ref',x['Capture ref']))
    for k,col in M:
        exp=r.get(k,'') or ''
        got=x.get(col)
        got='' if got is None else got
        if k in NUM and exp!='': exp=num(exp)
        if k=='nic': exp=exp.upper()
        if k=='remarks' or k=='address': pass
        out['checked']+=1
        if (exp if not isinstance(exp,str) else exp) != (got if not isinstance(got,str) else got):
            if isinstance(exp,(int,float)) and isinstance(got,(int,float)) and abs(exp-got)<1e-9: continue
            out['mismatch'].append((ref,col,repr(exp),repr(got)))
    # from-list flags
    exp_ds = r['dsMode']=='list'; exp_gn = r['gnMode']=='list' and r['dsMode']=='list'; exp_cat=r['catMode']=='list'
    for col,e in [('DS from audit list',exp_ds),('GN from audit list',exp_gn),('Category from list',exp_cat)]:
        out['checked']+=1
        if x[col]!=('Yes' if e else 'No'): out['mismatch'].append((ref,col,e,x[col]))
    out['checked']+=2
    if x['Existing resources (rows)']!=len(r['resEx']): out['mismatch'].append((ref,'ex rows',len(r['resEx']),x['Existing resources (rows)']))
    if x['Required resources (rows)']!=len(r['resRq']): out['mismatch'].append((ref,'rq rows',len(r['resRq']),x['Required resources (rows)']))
# resource sheets
ex=list(wb['Existing resources'].iter_rows(min_row=2,values_only=True));rq=list(wb['Required resources'].iter_rows(min_row=2,values_only=True))
exp_ex=[(f"L1-{i+1:03d}",j+1,x['item'],num(x['qty']),x['unit'],x['cond'],x['remarks'] or None) for i,r in enumerate(recs) for j,x in enumerate(r['resEx'])]
got_ex=[(a,d,e,f,g,h,k) for (a,b,c,d,e,f,g,h,k) in ex]
exp_rq=[(f"L1-{i+1:03d}",j+1,x['item'],num(x['qty']),x['unit'],num(x['cost']),x['priority'],x['remarks'] or None) for i,r in enumerate(recs) for j,x in enumerate(r['resRq'])]
got_rq=[(a,d,e,f,g,h,k,l) for (a,b,c,d,e,f,g,h,k,l) in rq]
out['ex_rows']=(len(exp_ex),len(got_ex),exp_ex==got_ex);out['rq_rows']=(len(exp_rq),len(got_rq),exp_rq==got_rq)
if exp_ex!=got_ex: out['mismatch'].append(('ex sheet',[ (a,b) for a,b in zip(exp_ex,got_ex) if a!=b][:3]))
if exp_rq!=got_rq: out['mismatch'].append(('rq sheet',[ (a,b) for a,b in zip(exp_rq,got_rq) if a!=b][:3]))
# text types
out['nic_text']=all(isinstance(x['NIC number'],str) for x in rows); out['mobile_text_leading0']=all(isinstance(x['Mobile number'],str) and x['Mobile number'].startswith('07') for x in rows)
out['unicode_ok']=any('අනුරාධපුර' in (x['Permanent address'] or '') for x in rows) and any('கணேசன்' in (x['Full name (as on NIC)'] or '') or 'மாலதி' in (x['Full name (as on NIC)'] or '') or 'அருண்' in (x['Full name (as on NIC)'] or '') for x in rows)
out['status_check']=sum(1 for x in rows if x['Capture status']=='Check')
print(json.dumps({k:v for k,v in out.items() if k!='mismatch'},ensure_ascii=False));print('mismatches',len(out['mismatch']));[print(m) for m in out['mismatch'][:15]]
json.dump(out,open('compare_result.json','w'),ensure_ascii=False,default=str)
