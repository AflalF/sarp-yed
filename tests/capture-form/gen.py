import os
import json,random,datetime
random.seed(18)
gn=json.load(open(os.path.join(os.path.dirname(__file__),'../../capture-form/ds_gn_audit_list.json')))
cats=["Vegetable cultivation","Fruit cultivation","Mushroom production","Protected agriculture","Plant nursery","Organic agriculture","Irrigation technology","Livestock","Aquaculture","Post-harvest management","Food processing","Value addition","Marketing"]
ML=[31,29,31,30,31,30,31,31,30,31,30,31]
def nic(d,female,old):
    doy=sum(ML[:d.month-1])+d.day+(500 if female else 0)
    if old: return f"{d.year%100:02d}{doy:03d}{random.randint(1000,9999)}{random.choice('VX')}"
    return f"{d.year}{doy:03d}{random.randint(1000,9999)}{random.randint(0,9)}"
names_si=["සමන් කුමාර","නිමාලි පෙරේරා","කසුන් බණ්ඩාර"];names_ta=["கணேசன் ராஜா","மாலதி சிவம்","அருண் குமார்"]
recs=[]
for i in range(85):
    g=random.choice(gn); d,ds,_,gname=g
    female=random.random()<0.5
    dob=datetime.date(random.randint(1989,2007),random.randint(1,12),random.randint(1,28))
    old=dob.year<2000 and random.random()<0.5
    r={"district":d,"dsMode":"list","ds":ds,"gnMode":"list","gnName":gname,"gnNo":"",
       "name":(random.choice(names_si+names_ta) if i%10==0 else f"Applicant {i+1:03d} Test")+(f" {i+1:03d}" if i%10==0 else ""),
       "nic":nic(dob,female,old),"dob":dob.isoformat(),"gender":"Female" if female else "Male",
       "lang":random.choice(["Sinhala","Tamil","English"]),"edu":random.choice(["","G.C.E. O/L","G.C.E. A/L","Diploma","Degree"]),
       "mobile":f"07{random.choice('01245678')}{random.randint(1000000,9999999)}","whatsapp":"" if i%3 else f"+9477{random.randint(1000000,9999999)}",
       "email":"" if i%4 else f"applicant{i+1}@example.com","address":f"{i+1} Main Road, {ds}" + (", අනුරාධපුර" if i%7==0 else ""),
       "business":f"Business plan number {i+1}","catMode":"list","category":cats[i%13],"type":"Scale-up" if i%4==0 else "Start-up",
       "bizReg":random.choice(["","Yes","No"]),"landExtent":"" if i%5==0 else f"{random.randint(1,300)/100:.2f}","expYears":str(random.randint(0,8)),
       "expText":"Family farm experience" if i%2 else "",
       "finTotal":"","finOwn":"","finLoan":"","finSarp":"",
       "resExText":"" if i%3 else "2 cows, small shed, dug well","resRqText":"" if i%4 else "Polytunnel 20 x 8 m; drip kit",
       "resEx":[],"resRq":[],"consent":"Yes","consultConsent":random.choice(["Yes","No"]),"consentRef":f"CF-{i+1:04d}","nicSeen":True,"remarks":"" if i%6 else "Line one remark, with comma and \"quotes\""}
    if r["bizReg"]=="Yes": r["bizRegNo"]=f"REG/{i+1}"; r["bizRegAuth"]="Divisional Secretariat"
    if i%9==0: r["gnMode"]="other"; r["gnName"]=f"Typed GN {i+1}"; r["gnNo"]=str(100+i)
    if i%17==0: r["dsMode"]="other"; r["ds"]=f"Typed DS {i+1}"; r["gnMode"]="other"; r["gnName"]=f"Typed GN {i+1}"; r["gnNo"]=""
    if i%11==0: r["catMode"]="other"; r["category"]="Spice processing"
    if r["type"]=="Scale-up": r.update(exName=f"Farm {i+1}",exBrand="Fresh"+str(i),exInvest="250,000",exTurnover="600000",exProfit="-20000",exYears="2",exProfitable="No")
    if i%2==0: r.update(finTotal="2000000",finOwn="300000",finLoan="800000",finSarp="900000")
    if i%3==0: r["resEx"]=[{"item":"Water pump","qty":"1","unit":"Nos","cond":"Good","remarks":""},{"item":"Land","qty":"0.5","unit":"acres","cond":"Owned","remarks":"leased part"}]
    if i%5==0: r["resRq"]=[{"item":"Polytunnel","qty":"1","unit":"Nos","cost":"1200000","priority":"High","remarks":""},{"item":"Drip kit","qty":"2","unit":"set","cost":"150000","priority":"Medium","remarks":""},{"item":"Seedlings","qty":"500","unit":"Nos","cost":"25000","priority":"Low","remarks":"hybrid"}]
    recs.append(r)
# ensure unique NIC and mobile
assert len({r['nic'] for r in recs})==85
json.dump(recs,open('recs.json','w'),ensure_ascii=False,indent=0)
print(sum(1 for r in recs if r['type']=='Scale-up'),'scale-up', sum(len(r['resEx']) for r in recs),'ex rows',sum(len(r['resRq']) for r in recs),'rq rows')
