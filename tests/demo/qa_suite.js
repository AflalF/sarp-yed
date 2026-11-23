// SARP YED demo — automated QA suite (Playwright). Each test runs in a fresh browser context.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const APP = "file://" + path.resolve(__dirname, "../../demo/sarp-yed-demo.html");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const T = []; // test registry
const test = (id, area, title, reqs, expected, fn) => T.push({ id, area, title, reqs, expected, fn });
class Fail extends Error {}
const expect = (cond, msg) => { if (!cond) throw new Fail(msg); };

// ---------- helpers bound per page ----------
function H(page) {
  const h = {};
  h.role = async (r) => { await page.selectOption("#roleSel", r); await page.waitForTimeout(60); };
  h.nav = async (k) => { await page.click(`[data-nav="${k}"]`); await page.waitForTimeout(60); };
  h.open = async (ref, tab = "overview") => { await page.evaluate(([r, t]) => { ui.view = "app"; ui.app = r; ui.tab = t; render(); }, [ref, tab]); };
  h.app = (ref) => page.evaluate((r) => { const a = byId(r); return a ? JSON.parse(JSON.stringify(a)) : null; }, ref);
  h.status = async (ref) => (await h.app(ref)).status;
  h.act = async (label) => { await page.locator(`.actions button:has-text("${label}")`).click(); await page.waitForTimeout(80); };
  h.hasAct = async (label) => (await page.locator(`.actions button:has-text("${label}")`).count()) > 0;
  h.ok = async () => { await page.click("#mok"); await page.waitForTimeout(100); };
  h.toast = async () => { const t = page.locator("#toast"); return (await t.count()) ? (await t.textContent()) : ""; };
  h.modalOpen = async () => (await page.locator(".modal").count()) > 0;
  h.close = async () => { if (await h.modalOpen()) { await page.locator(".modal [data-close]").first().click(); await page.waitForTimeout(60); } };
  h.find = (pred) => page.evaluate((p) => { const f = new Function("a", "return " + p); const a = DB.apps.find(f); return a ? (a.id || a.rec) : null; }, pred);
  // register through the UI; overrides: {name,nic,dob,consent,nicDoc,ai}
  h.register = async (o = {}) => {
    await h.role("FO"); await h.nav("register"); await page.click("[data-fill]");
    if (o.name) await page.fill('[name="name"]', o.name);
    if (o.dob) await page.fill('[name="dob"]', o.dob);
    if (o.nic) await page.fill('[name="nic"]', o.nic);
    if (o.consent === false) await page.uncheck('[name="consent"]');
    if (o.nicDoc === false) await page.uncheck('[name="nicDoc"]');
    if (o.consult) await page.check(`[name="consult"][value="${o.consult}"]`);
    const before = await page.evaluate(() => DB.apps.length);
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(150);
    const after = await page.evaluate(() => DB.apps.length);
    if (after === before) return null;
    return page.evaluate(() => { const a = DB.apps[DB.apps.length - 1]; return a.id || a.rec; });
  };
  h.makeNIC = (dob, g) => page.evaluate(([d, gg]) => makeNIC(d, gg, seeded(Date.now() % 100000)), [dob, g]);
  // drive a fresh applicant to a target point
  h.toShortlisted = async () => {
    const id = await h.register(); await h.role("ST"); await h.open(id);
    await h.act("Schedule interview"); await page.check("#coi"); await h.ok();
    await h.act("Open interview form"); await h.ok();
    await h.act("Scorecard and decision"); for (let j = 0; j < 2; j++) for (let i = 0; i < 7; i++) await page.selectOption(`[data-sc="${j}.${i}"]`, "4"); await h.ok();
    return id;
  };
  h.toAssigned = async () => { const id = await h.toShortlisted(); await h.act("Assign to freelancer"); await h.ok(); return id; };
  h.completeProposal = async (id) => {
    await h.role("FL"); await h.open(id, "proposal");
    for (const n of [2, 3, 4, 5, 6, 7]) { await page.click(`[data-ai="${n}"]`); await page.waitForTimeout(60); await page.check("#okp"); await h.ok(); }
    for (const n of [2, 3, 4, 5, 6, 7]) { await page.check(`[data-conf="${n}"]`); await page.waitForTimeout(60); }
    await h.open(id, "docs");
    for (let k = 0; k < 12; k++) { const up = page.locator('[data-up]:has-text("Upload")'); if (!(await up.count())) break; await up.first().click(); await page.waitForTimeout(60); await h.ok(); }
  };
  h.toUVR = async () => { const id = await h.toAssigned(); await h.completeProposal(id); await h.act("Submit for verification"); await h.ok(); return id; };
  h.verifyAll = async (id) => { await h.role("RV"); await h.open(id, "docs"); for (let k = 0; k < 15; k++) { const v = page.locator("[data-ver]"); if (!(await v.count())) break; await v.first().click(); await page.waitForTimeout(50); } };
  h.toPMA = async () => { const id = await h.toUVR(); await h.verifyAll(id); await h.act("Release to management"); await h.ok(); return id; };
  h.toAFS = async () => { const id = await h.toPMA(); await h.role("MG"); await h.open(id); await h.act("Approve (security key)"); await h.ok(); await page.click("#keyBtn"); await page.waitForTimeout(700); return id; };
  h.toSUB = async () => { const id = await h.toAFS(); await h.role("SL"); await h.open(id); await h.act("Record submission to SARP"); await h.ok(); return id; };
  return h;
}

// =====================================================================
// A. REGISTRATION (SOP 01)
// =====================================================================
test("TC-01", "Registration", "Valid registration issues a beneficiary ID", "FR-REG-002, FR-REG-003, §6.1",
  "Status Registered; ID SARP-VAV-NNNN; gate G1 documents Uploaded", async (page, h) => {
    const id = await h.register(); const a = await h.app(id);
    expect(/^SARP-VAV-\d{4}$/.test(a.id), "ID format wrong: " + a.id);
    expect(a.status === "REG", "status " + a.status);
    expect(a.docs.nic.status === "Uploaded" && a.docs.consent.status === "Uploaded", "G1 docs not uploaded");
    return `${a.id}, ${a.status}, NIC and consent Uploaded`;
  });
test("TC-02", "Registration", "Invalid NIC format is rejected", "Rule E2, FR-REG-002",
  "Inline error shown; no record created", async (page, h) => {
    const id = await h.register({ nic: "12345ABC" });
    const err = await page.textContent("#nicErr");
    expect(id === null, "record was created"); expect(/Not a valid NIC/.test(err), "no inline error");
    return "Inline error shown; no record created";
  });
test("TC-03", "Registration", "Date of birth must match the NIC", "Rule E2",
  "Save blocked with message naming the NIC date", async (page, h) => {
    const nic = await h.makeNIC("1999-04-18", "Female");
    const id = await h.register({ nic, dob: "1998-01-01" }); const t = await h.toast();
    expect(id === null, "record created"); expect(/must match the NIC/.test(t), "message: " + t);
    return t;
  });
test("TC-04", "Registration", "Applicant outside the youth band goes to Eligibility review", "Rule E1, FR-REG-002, §8.6",
  "Status Eligibility review; no ID issued; reason lists E1", async (page, h) => {
    const nic = await h.makeNIC("1985-06-01", "Male");
    const id = await h.register({ nic, dob: "1985-06-01" }); const a = await h.app(id);
    expect(a.status === "ELR", "status " + a.status); expect(!a.id, "ID issued"); expect(a.eligibility.some((e) => e.startsWith("E1")), "no E1 reason");
    return `${a.rec}: ${a.eligibility[0]}`;
  });
test("TC-05", "Registration", "Duplicate NIC goes to Eligibility review, linked to the existing record", "Rule E3, FR-REG-012",
  "Status Eligibility review; reason names the existing ID", async (page, h) => {
    const first = await h.register(); const a1 = await h.app(first);
    const id2 = await h.register({ nic: a1.nic, dob: a1.dob }); const a2 = await h.app(id2);
    expect(a2.status === "ELR", "status " + a2.status); expect(a2.eligibility.some((e) => e.includes(first)), "not linked: " + a2.eligibility);
    return a2.eligibility[0];
  });
test("TC-06", "Registration", "Consent and NIC copy are required (gate G1)", "FR-REG-007, §6.7 G1",
  "Save blocked with gate G1 message", async (page, h) => {
    const id = await h.register({ consent: false }); const t = await h.toast();
    expect(id === null, "record created"); expect(/Gate G1/.test(t), "message: " + t);
    return t;
  });
test("TC-07", "Registration", "Mandatory fields enforced", "FR-REG-002",
  "Browser validation stops submission when a required field is empty", async (page, h) => {
    const id = await h.register({ name: " " }); // whitespace-only name
    const id2 = await (async () => { await h.nav("register"); await page.click("[data-fill]"); await page.fill('[name="business"]', ""); const b = await page.evaluate(() => DB.apps.length); await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(100); return (await page.evaluate(() => DB.apps.length)) - b; })();
    expect(id2 === 0, "empty business accepted"); expect(id === null, "name of spaces only was accepted");
    return "Empty business and spaces-only name both blocked";
  });
test("TC-08", "Registration", "Beneficiary IDs run in sequence per district and are never reused", "§6.1",
  "Two registrations get consecutive numbers", async (page, h) => {
    const a = await h.register(); const b = await h.register();
    const na = +a.slice(-4), nb = +b.slice(-4);
    expect(nb === na + 1, `${a} then ${b}`);
    return `${a} → ${b}`;
  });
test("TC-09", "Access", "Field Officer sees only their district", "FR-UM-010",
  "Applicants list contains only Vavuniya records", async (page, h) => {
    await h.role("FO"); await h.nav("applicants");
    const districts = await page.locator("tr.click td:nth-child(3)").allTextContents();
    expect(districts.length > 0 && districts.every((d) => d === "Vavuniya"), "found " + [...new Set(districts)]);
    return `${districts.length} records, all Vavuniya`;
  });

// =====================================================================
// B. ELIGIBILITY REVIEW
// =====================================================================
test("TC-10", "Eligibility review", "Confirming ineligible needs a Senior Team reason", "FR-REG-011, §4.4",
  "Blocked without reason; with reason status becomes Ineligible", async (page, h) => {
    const id = await h.find('a.status==="ELR"'); await h.role("ST"); await h.open(id);
    await h.act("Confirm ineligible"); await h.ok(); const t = await h.toast();
    expect(/reason is required/.test(t) && (await h.status(id)) === "ELR", "accepted without reason");
    await page.fill("#mr", "Over age limit; confirmed with original NIC"); await h.ok();
    expect((await h.status(id)) === "INE", "not Ineligible");
    return "Reason enforced; status Ineligible";
  });
test("TC-11", "Eligibility review", "Field Officer corrects a data-entry error and the record registers", "FR-REG-011, §4.4 ELR→REG",
  "After correcting the NIC, checks pass and an ID is issued", async (page, h) => {
    const first = await h.register(); const a1 = await h.app(first);
    const dup = await h.register({ nic: a1.nic, dob: a1.dob });
    await h.open(dup); await h.act("Correct data and re-check");
    const nic = await h.makeNIC(a1.dob, a1.gender); await page.fill("#e2", nic); await h.ok();
    const a = await h.app(dup) || await h.app(await h.find(`a.nic==="${nic}"`));
    expect(a.status === "REG" && /^SARP-VAV-/.test(a.id), "status " + a.status);
    return `${a.id} registered after correction`;
  });
test("TC-12", "Eligibility review", "Management can reopen an Ineligible decision with evidence", "§4.4 INE→ELR, §6.2",
  "Status returns to Eligibility review", async (page, h) => {
    const id = await h.find('a.status==="INE"'); await h.role("MG"); await h.open(id);
    await h.act("Reopen eligibility review"); await h.ok(); expect((await h.status(id)) === "INE", "reopened without reason");
    await page.fill("#mr", "Birth certificate shows correct DOB"); await h.ok();
    expect((await h.status(id)) === "ELR", "status " + (await h.status(id)));
    return "Reason enforced; status Eligibility review";
  });

// =====================================================================
// C. INTERVIEW (SOP 02)
// =====================================================================
test("TC-13", "Interview", "Panel must have two different members", "FR-INT-002",
  "Same person twice is rejected", async (page, h) => {
    const id = await h.register(); await h.role("ST"); await h.open(id); await h.act("Schedule interview");
    await page.selectOption("#p2", "A. Fernando"); await page.check("#coi"); await h.ok();
    expect((await h.status(id)) === "REG", "scheduled with one person");
    return await h.toast();
  });
test("TC-14", "Interview", "Conflict-of-interest declaration is required", "FR-INT-003",
  "Scheduling blocked until declared", async (page, h) => {
    const id = await h.register(); await h.role("ST"); await h.open(id); await h.act("Schedule interview"); await h.ok();
    expect((await h.status(id)) === "REG", "scheduled without declaration");
    await page.check("#coi"); await h.ok(); expect((await h.status(id)) === "ISC", "not scheduled");
    return "Blocked, then scheduled after declaration";
  });
test("TC-15", "Interview", "Interview form A–F saves and records the site visit", "FR-INT-006, FR-INT-007",
  "Status Interviewed; site visit with GPS stored; G2 documents uploaded", async (page, h) => {
    const id = await h.register(); await h.role("ST"); await h.open(id); await h.act("Schedule interview"); await page.check("#coi"); await h.ok();
    await h.act("Open interview form"); await h.ok(); const a = await h.app(id);
    expect(a.status === "INT" && a.interview.siteVisit && a.interview.siteVisit.gps, "status " + a.status);
    expect(a.docs.land.status === "Uploaded" && a.docs.photos.status === "Uploaded", "G2 docs missing");
    return `Interviewed; GPS ${a.interview.siteVisit.gps}`;
  });
test("TC-16", "Interview", "Weighted score calculation", "§6.4",
  "Scores 4,4,3,4,3,4,3 give 72; all 4s give 80; all 5s give 100", async (page, h) => {
    const r = await page.evaluate(() => [scoreTotal({ a: [4, 4, 3, 4, 3, 4, 3], b: [4, 4, 3, 4, 3, 4, 3] }).total, scoreTotal({ a: [4, 4, 4, 4, 4, 4, 4], b: [4, 4, 4, 4, 4, 4, 4] }).total, scoreTotal({ a: [5, 5, 5, 5, 5, 5, 5], b: [5, 5, 5, 5, 5, 5, 5] }).total, scoreTotal({ a: [5, 5, 5, 5, 5, 5, 5], b: [3, 3, 3, 3, 3, 3, 3] }).total]);
    expect(r[0] === 72 && r[1] === 80 && r[2] === 100 && r[3] === 80, "got " + r);
    return `72 / 80 / 100; panel average of 5s and 3s = ${r[3]}`;
  });
test("TC-17", "Interview", "Decision bands at the boundaries", "§6.4",
  "70 Shortlisted, 69.9 On hold, 50 On hold, 49.9 Not shortlisted", async (page, h) => {
    const r = await page.evaluate(() => [70, 69.9, 50, 49.9].map(bandOf2));
    expect(r.join() === "Shortlisted,On hold,On hold,Not shortlisted", "got " + r);
    return r.join(" / ");
  });
test("TC-18", "Interview", "Overriding the suggested band needs a reason", "FR-INT-010",
  "Blocked without reason; saved with reason and stored", async (page, h) => {
    const id = await h.register(); await h.role("ST"); await h.open(id); await h.act("Schedule interview"); await page.check("#coi"); await h.ok();
    await h.act("Open interview form"); await h.ok(); await h.act("Scorecard and decision");
    for (let j = 0; j < 2; j++) for (let i = 0; i < 7; i++) await page.selectOption(`[data-sc="${j}.${i}"]`, "4");
    await page.selectOption("#dec", "On hold"); await h.ok();
    expect((await h.status(id)) === "INT", "override accepted without reason");
    await page.fill("#ovr", "Water source to be re-tested"); await h.ok();
    const a = await h.app(id); expect(a.status === "HLD" && a.interview.override, "status " + a.status);
    return "Blocked, then On hold with reason recorded";
  });
test("TC-19", "Interview", "Shortlisting blocked when gate G2 documents are missing", "§6.7 G2, §4.4",
  "Shortlisting refused naming the missing documents", async (page, h) => {
    const id = await h.register(); await h.role("ST"); await h.open(id); await h.act("Schedule interview"); await page.check("#coi"); await h.ok();
    await h.act("Open interview form"); await page.uncheck("#d3"); await h.ok();
    await h.act("Scorecard and decision"); for (let j = 0; j < 2; j++) for (let i = 0; i < 7; i++) await page.selectOption(`[data-sc="${j}.${i}"]`, "4"); await h.ok();
    const t = await h.toast(); expect((await h.status(id)) === "INT" && /Gate G2/.test(t), "status " + (await h.status(id)));
    return t;
  });
test("TC-20", "Interview", "Assignment to a freelancer", "FR-PRO-001, FR-PRO-002",
  "Status Assigned to freelancer; target date set; workload shown", async (page, h) => {
    const id = await h.toShortlisted(); await h.act("Assign to freelancer");
    const counts = await page.locator(".modal td.num").count(); await h.ok(); const a = await h.app(id);
    expect(a.status === "ASG" && a.assignment.freelancer === "N. Silva" && a.assignment.target, "status " + a.status);
    expect(counts >= 6, "workload not shown");
    return `Assigned to ${a.assignment.freelancer}, target ${a.assignment.target}`;
  });

// =====================================================================
// D. PROPOSAL (SOP 03)
// =====================================================================
test("TC-21", "Access", "Freelancer sees only assigned applicants", "FR-UM-011",
  "Every record listed is assigned to N. Silva", async (page, h) => {
    await h.role("FL"); await h.nav("applicants");
    const ids = await page.locator("tr.click").evaluateAll((rows) => rows.map((r) => r.dataset.open));
    const fl = await page.evaluate((ids) => ids.map((i) => byId(i).assignment && byId(i).assignment.freelancer), ids);
    expect(ids.length > 0 && fl.every((f) => f === "N. Silva"), "found " + fl);
    return `${ids.length} records, all assigned to N. Silva`;
  });
test("TC-22", "AI and privacy", "AI payload filter removes personal details", "FR-PRO-011, §10.7",
  "NIC, phone, email, name and place removed; province only; no district or DS/GN", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "proposal");
    await page.click('[data-ai="2"]');
    await page.fill("#brief", "Meera Sivalingam (NIC 199910804567, 0771234567, meera@example.com) from Vavuniya, GN 214, plans tomatoes.");
    await page.click("#prev"); const json = await page.locator(".json").textContent();
    const p = JSON.parse(json);
    const leaks = ["Meera", "Sivalingam", "199910804567", "0771234567", "meera@example.com", "Vavuniya", "GN 214"].filter((x) => json.includes(x));
    expect(leaks.length === 0, "leaked: " + leaks); expect(p.province === "Northern" && !("district" in p), "location field wrong");
    return "No leaks; province = " + p.province;
  });
test("TC-23", "AI and privacy", "AI request blocked until the freelancer confirms the preview", "FR-PRO-017",
  "No draft created without the confirmation tick", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "proposal");
    await page.click('[data-ai="2"]'); await h.ok(); const a = await h.app(id);
    expect(!a.sections[2].ai && (await h.modalOpen()), "draft created without confirmation");
    return await h.toast();
  });
test("TC-24", "AI and privacy", "Applicant who answers No to Indo-Lanka consultancy is not assigned to a freelancer", "FR-REG-007, FR-PRO-012",
  "No 'Assign to freelancer' action; referral to SARP PMU recorded", async (page, h) => {
    const id = await h.register({ consult: "No" }); await h.role("ST"); await h.open(id);
    await h.act("Schedule interview"); await page.check("#coi"); await h.ok(); await h.act("Open interview form"); await h.ok();
    await h.act("Scorecard and decision"); for (let j = 0; j < 2; j++) for (let i = 0; i < 7; i++) await page.selectOption(`[data-sc="${j}.${i}"]`, "4"); await h.ok();
    expect((await h.status(id)) === "SHL", "not shortlisted");
    expect(!(await h.hasAct("Assign to freelancer")), "assign action offered");
    await h.act("Refer to SARP PMU"); await h.ok(); const a = await h.app(id);
    expect(a.pmuRoute && a.consultConsent === "No" && a.history.some((x) => /SARP PMU/.test(x.note)), "referral not recorded");
    return "Assign hidden; referral to SARP PMU recorded in history";
  });
test("TC-25", "Proposal", "A section cannot be confirmed while empty", "FR-PRO-013",
  "Tick refused with message", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "proposal");
    await page.click('[data-conf="3"]'); await page.waitForTimeout(80); const a = await h.app(id);
    expect(!a.sections[3].confirmed, "empty section confirmed");
    return await h.toast();
  });
test("TC-26", "Financials", "Grant above LKR 900,000 fails check F2", "FR-FIN-006, §6.5 F2",
  "F2 fails at 1,000,000 grant; passes again when restored", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "finance");
    await page.fill('[data-f="inv.0.unit"]', "700000"); await page.press('[data-f="inv.0.unit"]', "Tab"); await page.waitForTimeout(100);
    const bad = await page.evaluate((i) => finCalc(byId(i).fin, DB.cfg).checks.map((c) => c.ok), id);
    await page.fill('[data-f="inv.0.unit"]', "600000"); await page.press('[data-f="inv.0.unit"]', "Tab"); await page.waitForTimeout(100);
    const good = await page.evaluate((i) => finCalc(byId(i).fin, DB.cfg).pass, id);
    expect(bad[1] === false && good === true, `F2 ${bad[1]}, restored ${good}`);
    return `F2 failed at grant 1,000,000 (F4 also ${bad[3] ? "passed" : "failed"}); all pass after restore`;
  });
test("TC-27", "Financials", "Loan amount must match loan-funded lines (F1)", "§6.5 F1",
  "F1 fails when loan amount differs", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "finance");
    await page.fill('[data-f="loan.amount"]', "400000"); await page.press('[data-f="loan.amount"]', "Tab"); await page.waitForTimeout(100);
    const c = await page.evaluate((i) => finCalc(byId(i).fin, DB.cfg).checks[0], id);
    expect(!c.ok, "F1 passed"); return c.t;
  });
test("TC-28", "Financials", "Project value rule: ceiling vs fixed", "§6.5 F4, Section 15.1 decision 3",
  "LKR 1.8m passes as ceiling, fails as fixed", async (page, h) => {
    const r = await page.evaluate(() => {
      const f = JSON.parse(JSON.stringify(finTemplate("Mushroom", "x", 1))); f.inv[4].unit = 0; f.inv[1].unit = 300000; f.inv[0].unit = 600000; f.inv[3].unit = 150000; f.inv[2].unit = 250000; f.inv[5].unit = 500000; f.inv[4].unit = 0;
      // TPC = 600+300+250+150+0+500 = 1.8m ; own = 400k
      const ceil = finCalc(f, { ...DB.cfg, projectRule: "ceiling" }).checks[3].ok;
      const fixed = finCalc(f, { ...DB.cfg, projectRule: "fixed" }).checks[3].ok;
      return [finCalc(f, DB.cfg).TPC, ceil, fixed];
    });
    expect(r[0] === 1800000 && r[1] === true && r[2] === false, "got " + r);
    return `TPC ${r[0].toLocaleString()}: ceiling pass, fixed fail`;
  });
test("TC-29", "Financials", "Financial model matches an independent calculation", "§6.6",
  "Revenue, depreciation, interest, net profit, ROI, payback and DSCR equal an independent calculation (±1 LKR)", async (page, h) => {
    const f = await page.evaluate(() => JSON.parse(JSON.stringify(byId("SARP-VAV-0001").fin)));
    const sys = await page.evaluate(() => finCalc(byId("SARP-VAV-0001").fin, DB.cfg));
    // independent implementation
    const n = f.years, inv = f.inv.map((l) => l.qty * l.unit), TPC = inv.reduce((a, b) => a + b, 0);
    const P = f.loan.amount, r = f.loan.rate / 1200, N = f.loan.months, pmt = P * r / (1 - Math.pow(1 + r, -N));
    let bal = P; const I = [0, 0, 0], PR = [0, 0, 0];
    for (let m = 0; m < N; m++) { const i = bal * r; I[Math.floor(m / 12)] += i; PR[Math.floor(m / 12)] += pmt - i; bal -= pmt - i; }
    const res = [];
    let cum = 0, pay = null; const NP = [];
    for (let y = 0; y < n; y++) {
      const R = f.rev.reduce((a, l) => a + l.qty[y] * l.price[y], 0), OC = f.opex.reduce((a, l) => a + l.y[y], 0);
      const D = f.inv.reduce((a, l, k) => a + (l.life > 0 && y < l.life ? inv[k] / l.life : 0), 0);
      NP[y] = R - OC - D - I[y]; const prev = cum; cum += R - OC; if (pay == null && cum >= TPC) pay = y + (TPC - prev) / (R - OC);
      res.push({ R, D, NP: NP[y], DSCR: (NP[y] + D + I[y]) / (PR[y] + I[y]) });
    }
    const ROI = NP.reduce((a, b) => a + b, 0) / n / TPC;
    const close = (a, b, tol = 1) => Math.abs(a - b) <= tol;
    for (let y = 0; y < n; y++) {
      expect(close(sys.R[y], res[y].R) && close(sys.D[y], res[y].D) && close(sys.NP[y], res[y].NP), `Year ${y + 1} mismatch`);
      expect(close(sys.DSCR[y], res[y].DSCR, 0.001), `DSCR Y${y + 1} mismatch`);
    }
    expect(close(sys.ROI, ROI, 1e-9) && close(sys.payback, pay, 1e-9), "ROI/payback mismatch");
    expect(close(sys.R[0], 2860000) && close(pay, 1 + 830000 / 2220000, 1e-9), "hand check failed");
    return `NP Y1–Y3 ${sys.NP.map((x) => Math.round(x).toLocaleString()).join(" / ")}; ROI ${(sys.ROI * 100).toFixed(1)}%; payback ${sys.payback.toFixed(2)} yrs; DSCR Y1 ${sys.DSCR[0].toFixed(2)}`;
  });
test("TC-30", "Proposal", "Submission for verification is blocked until complete", "§4.4 PIP→UVR, §6.7 G3",
  "Submit disabled with failing checks listed", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id); await h.act("Submit for verification");
    const dis = await page.locator("#mok").isDisabled(); const fails = await page.locator(".modal .bad").count();
    expect(dis && fails >= 3, `disabled ${dis}, failing ${fails}`);
    return `Submit disabled; ${fails} checks failing (sections, bank, gate G3)`;
  });
test("TC-31", "Documents", "Only PDF, JPG or PNG can be uploaded", "FR-DOC-002, SEC-FIL-01",
  "An .exe file name is refused", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "docs");
    await page.locator('[data-up="quotes"]').click(); await page.fill("#fn", "quotation.exe"); await h.ok();
    const a = await h.app(id); expect(a.docs.quotes.status === "Missing", "accepted .exe");
    return await h.toast();
  });

// =====================================================================
// E. VERIFICATION AND APPROVAL (SOP 04–05)
// =====================================================================
test("TC-32", "Verification", "Release blocked until every document is Verified (G4)", "§6.7 G4, §4.4 UVR→PMA",
  "Release disabled while items are unverified; enabled after", async (page, h) => {
    const id = await h.toUVR(); await h.role("RV"); await h.open(id); await h.act("Release to management");
    const dis1 = await page.locator("#mok").isDisabled(); await h.close();
    await h.verifyAll(id); await h.act("Release to management"); const dis2 = await page.locator("#mok").isDisabled(); await h.ok();
    expect(dis1 && !dis2 && (await h.status(id)) === "PMA", `before ${dis1}, after ${dis2}`);
    return "Disabled before verification; released after";
  });
test("TC-33", "Verification", "Returning a document needs a comment", "FR-DOC-009",
  "Blocked without comment; with comment status Returned", async (page, h) => {
    const id = await h.toUVR(); await h.role("RV"); await h.open(id, "docs");
    await page.locator('[data-ret="quotes"]').click(); await h.ok(); expect((await h.app(id)).docs.quotes.status !== "Returned", "returned without comment");
    await page.fill("#mr", "Quotation is unsigned"); await h.ok(); const d = (await h.app(id)).docs.quotes;
    expect(d.status === "Returned" && d.comment, "status " + d.status);
    return "Comment enforced; document Returned";
  });
test("TC-34", "Verification", "Return for correction sends the case back to the freelancer", "§4.4 UVR→RFC",
  "Comment mandatory; status Returned for correction; comment visible", async (page, h) => {
    const id = await h.toUVR(); await h.role("RV"); await h.open(id); await h.act("Return for correction"); await h.ok();
    expect((await h.status(id)) === "UVR", "returned without comment");
    await page.fill("#mr", "Section 6 needs named buyers"); await h.ok(); const a = await h.app(id);
    expect(a.status === "RFC" && a.comments.some((c) => /named buyers/.test(c.text)), "status " + a.status);
    return "Comment enforced; status Returned for correction";
  });
test("TC-35", "Approval", "Approval needs the security-key step", "FR-APP-003, SEC-IAM-08",
  "Cancelling the key step leaves the application pending", async (page, h) => {
    const id = await h.toPMA(); await h.role("MG"); await h.open(id); await h.act("Approve (security key)"); await h.ok();
    await page.locator(".modal [data-close]").click(); await page.waitForTimeout(100);
    expect((await h.status(id)) === "PMA", "approved without key");
    return "Status stays Pending management approval";
  });
test("TC-36", "Approval", "Approval generates the package and locks the record", "FR-APP-004, FR-APP-005, §6.8",
  "Status Approved for submission; package with checksum; no upload buttons", async (page, h) => {
    const id = await h.toAFS(); const a = await h.app(id);
    await h.role("FL"); await h.open(id, "docs"); const ups = await page.locator("[data-up]").count();
    expect(a.status === "AFS" && a.locked && a.package && a.package.checksum && ups === 0, `status ${a.status}, uploads ${ups}`);
    return `Locked; checksum ${a.package.checksum}`;
  });
test("TC-37", "Privacy", "NIC and bank account masked for non-management roles", "SEC-DAT-05, FR-APP-010",
  "Reviewer sees masked values; Management sees full", async (page, h) => {
    const id = await h.toPMA(); const a = await h.app(id);
    await h.role("RV"); await h.open(id); const txt = await page.locator("main").innerText();
    const rvLeak = txt.includes(a.nic) || txt.includes(a.bank.acct);
    await h.role("MG"); await h.open(id); const mg = await page.locator("main").innerText();
    expect(!rvLeak && mg.includes(a.nic), `reviewer leak ${rvLeak}`);
    return "Masked for Reviewer; full for Management";
  });

// =====================================================================
// F. SARP (Step 10)
// =====================================================================
test("TC-38", "Access", "Government Official sees only submitted records in scope", "FR-UM-012",
  "All visible records are Vavuniya and submitted or later", async (page, h) => {
    await h.role("GO"); await h.nav("applicants");
    const ids = await page.locator("tr.click").evaluateAll((rows) => rows.map((r) => r.dataset.open));
    const bad = await page.evaluate((ids) => ids.map(byId).filter((a) => a.district !== "VAV" || !["SUB", "USR", "SAP", "SRJ"].includes(a.status)).length, ids);
    expect(ids.length > 0 && bad === 0, `${ids.length} visible, ${bad} out of scope`);
    return `${ids.length} records, all in scope`;
  });
test("TC-39", "SARP decision", "Government Official cannot record the Committee decision", "FR-APP-007, FR-APP-011",
  "No Committee button; only own stage offered", async (page, h) => {
    const id = await h.toSUB(); await h.role("GO"); await h.open(id);
    const dec = await h.hasAct("Committee decision"); await h.act("Record review stage");
    const opts = await page.locator("#s1 option").allTextContents();
    expect(!dec && opts.length === 1 && opts[0] === "Line agency review", `decision ${dec}, stages ${opts}`);
    return "No decision button; stage = Line agency review only";
  });
test("TC-40", "SARP decision", "Committee decision needs evidence", "FR-APP-011",
  "Refused with empty evidence; saved when complete", async (page, h) => {
    const id = await h.toSUB(); await h.role("PMU"); await h.open(id); await h.act("Record Committee decision"); await h.ok();
    expect((await h.status(id)) === "SUB", "saved without evidence");
    await page.fill("#c1", "2026-11-20"); await page.fill("#c2", "PC/2026/11/09"); await page.fill("#c3", "minutes.pdf"); await page.fill("#c5", "Approved"); await h.ok();
    const a = await h.app(id); const e = a.sarp.find((s) => s.stage === "SARP Project Committee");
    expect(a.status === "SAP" && e.evidence.minute === "PC/2026/11/09", "status " + a.status);
    return "Refused without evidence; SARP approved with minute PC/2026/11/09";
  });
test("TC-41", "SARP decision", "SARP Liaison's Committee entry needs Management confirmation", "FR-APP-011, §4.4",
  "Security-key confirmation required; entry shows confirmed by Management", async (page, h) => {
    const id = await h.toSUB(); await h.role("SL"); await h.open(id); await h.act("Record Committee decision");
    await page.fill("#c1", "2026-11-20"); await page.fill("#c2", "PC/2026/11/10"); await page.fill("#c3", "letter.pdf"); await page.fill("#c5", "Approved"); await h.ok();
    const keyShown = (await page.locator("#keyBtn").count()) > 0; expect(keyShown && (await h.status(id)) === "SUB", "no confirmation step");
    await page.click("#keyBtn"); await page.waitForTimeout(700); const a = await h.app(id);
    const e = a.sarp.find((s) => s.stage === "SARP Project Committee");
    expect(a.status === "SAP" && e.confirmedBy === "L. Senanayake", "confirmedBy " + e.confirmedBy);
    return "Key step shown; confirmed by L. Senanayake";
  });
test("TC-42", "SARP decision", "Clarification reopens the case as a new version", "FR-APP-008, §6.8",
  "Status Returned for correction; version 2; comment recorded", async (page, h) => {
    const id = await h.toSUB(); await h.role("PMU"); await h.open(id); await h.act("Record Committee decision");
    await page.selectOption("#c0", "Clarification requested"); await page.fill("#c1", "2026-11-20"); await page.fill("#c2", "PC/2026/11/11"); await page.fill("#c3", "m.pdf"); await page.fill("#c5", "Explain the market for tomatoes"); await h.ok();
    const a = await h.app(id);
    expect(a.status === "RFC" && a.version === 2 && a.package && a.package.version === 1, `status ${a.status}, v${a.version}, package v${a.package && a.package.version}`);
    return "Returned for correction; version 2; submitted package v1 kept";
  });

// =====================================================================
// G. CROSS-CUTTING
// =====================================================================
test("TC-43", "Audit", "Actions are written to the audit log", "FR-AUD-001",
  "Registration and approval entries with user and role", async (page, h) => {
    const id = await h.toAFS(); const audit = await page.evaluate(() => DB.audit);
    const reg = audit.find((x) => x.ref === id && /Registered/.test(x.action)), appr = audit.find((x) => x.ref === id && /Approved for submission/.test(x.action));
    expect(reg && appr && appr.user === "L. Senanayake" && appr.role === "Management", "missing entries");
    return `${audit.filter((x) => x.ref === id).length} entries for ${id}`;
  });
test("TC-44", "Access", "System Administrator has no access to applicant records", "FR-UM-013",
  "No Applicants menu; record view blocked", async (page, h) => {
    await h.role("AD"); const menu = await page.locator('[data-nav="applicants"]').count();
    const vis = await page.evaluate(() => visibleApps().length);
    expect(menu === 0 && vis === 0, `menu ${menu}, visible ${vis}`);
    return "No applicant menu; 0 records visible";
  });
test("TC-45", "Settings", "Only the Administrator can change rules", "FR-ADM-001, §5.10",
  "Management sees settings read-only; Administrator can edit", async (page, h) => {
    await h.role("MG"); await h.nav("settings"); const mgDis = await page.locator('[data-cfg="ageMax"]').isDisabled();
    await h.role("AD"); await h.nav("settings"); await page.fill('[data-cfg="ageMax"]', "34"); await page.press('[data-cfg="ageMax"]', "Tab"); await page.waitForTimeout(80);
    const v = await page.evaluate(() => DB.cfg.ageMax);
    expect(mgDis && v === 34, `MG disabled ${mgDis}, value ${v}`);
    return "Read-only for Management; Administrator change saved and logged";
  });
test("TC-46", "Robustness", "Data persists after reload; reset restores the sample", "Demo",
  "New record survives reload; reset returns to 31 records", async (page, h) => {
    const id = await h.register(); await page.reload(); await page.waitForTimeout(150);
    const kept = await page.evaluate((i) => !!byId(i), id);
    await page.click('[data-act="reset"]'); await h.ok(); const n = await page.evaluate(() => DB.apps.length);
    expect(kept && n === 31, `kept ${kept}, after reset ${n}`);
    return "Persisted; reset to 31";
  });
test("TC-47", "Security", "Script in user input is shown as text, not run (XSS)", "SEC-APP-01",
  "Name with HTML/script stored and shown as text; no script runs", async (page, h) => {
    await page.evaluate(() => { window.__xss = 0; });
    await h.role("FO"); await h.nav("register"); await page.click("[data-fill]");
    await page.fill('[name="business"]', '<img src=x onerror="window.__xss=1">Tomato'); await page.fill('[name="address"]', '<script>window.__xss=2</script>');
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(150);
    await h.nav("applicants"); await page.waitForTimeout(100);
    const x = await page.evaluate(() => window.__xss); const imgs = await page.locator("main img").count();
    expect(x === 0 && imgs === 0, `xss flag ${x}, injected imgs ${imgs}`);
    return "Rendered as text; no script executed";
  });
test("TC-48", "Settings", "Logo upload validates size and type", "Demo branding",
  "Non-image and >1 MB files refused; valid PNG accepted", async (page, h) => {
    const big = path.join(OUT, "big.png"), txt = path.join(OUT, "notes.txt"), ok = path.join(__dirname, "..", "demo_test", "t1.png");
    fs.writeFileSync(big, Buffer.concat([fs.readFileSync(ok), Buffer.alloc(1100000)])); fs.writeFileSync(txt, "hello");
    await h.role("AD"); await h.nav("settings");
    await page.setInputFiles('[data-logo="gov"]', big); await page.waitForTimeout(150); const t1 = await h.toast();
    await page.setInputFiles('[data-logo="gov"]', txt); await page.waitForTimeout(150); const t2 = await h.toast();
    const none = await page.evaluate(() => !LOGOS.gov);
    await page.setInputFiles('[data-logo="gov"]', ok); await page.waitForTimeout(300); const has = await page.evaluate(() => !!LOGOS.gov);
    expect(none && has && /1 MB/.test(t1) && /PNG, JPG or SVG/.test(t2), `${t1} | ${t2}`);
    return "Oversize and text files refused; PNG accepted";
  });
test("TC-49", "Robustness", "Withdrawal needs a reason", "§4.4 Any→WDN",
  "Blocked without reason; Withdrawn with reason", async (page, h) => {
    const id = await h.register(); await h.open(id); await h.act("Withdraw application"); await h.ok();
    expect((await h.status(id)) === "REG", "withdrawn without reason");
    await page.fill("#mr", "Applicant moved abroad"); await h.ok(); expect((await h.status(id)) === "WDN", "not withdrawn");
    return "Reason enforced; Withdrawn";
  });
test("TC-50", "Usability", "Phone-width layout has no horizontal scrolling", "Responsive",
  "At 390 px wide, page width ≤ viewport on dashboard, list and record", async (page, h) => {
    await page.setViewportSize({ width: 390, height: 844 }); const widths = [];
    await h.role("MG"); await h.nav("dashboard"); widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
    await h.nav("applicants"); widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
    await h.open("SARP-VAV-0001", "finance"); widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
    await page.screenshot({ path: path.join(OUT, "TC-50_mobile.png") });
    expect(widths.every((w) => w <= 392), "scroll widths " + widths);
    return "Scroll widths " + widths.join(", ");
  });
test("TC-51", "End to end", "Full journey: registration to SARP approval", "SOP 01–05",
  "Reaches SARP approved with no console errors", async (page, h) => {
    const id = await h.toSUB(); await h.role("GO"); await h.open(id); await h.act("Record review stage"); await page.fill("#s3", "Feasible"); await h.ok();
    await h.role("PMU"); await h.open(id); await h.act("Record Committee decision"); await page.fill("#c1", "2026-11-20"); await page.fill("#c2", "PC/1"); await page.fill("#c3", "m.pdf"); await page.fill("#c5", "OK"); await h.ok();
    const a = await h.app(id); expect(a.status === "SAP", "status " + a.status);
    return `${id}: ${a.history.length} status changes, ended SARP approved`;
  });

test("TC-52", "Financials", "Negative or non-numeric amounts are refused", "FR-FIN-001, NFR-12",
  "-650000 and 'abc' rejected with a message; value unchanged", async (page, h) => {
    const id = await h.toAssigned(); await h.role("FL"); await h.open(id, "finance");
    const before = (await h.app(id)).fin.inv[0].unit;
    await page.fill('[data-f="inv.0.unit"]', "-650000"); await page.press('[data-f="inv.0.unit"]', "Tab"); await page.waitForTimeout(80); const t1 = await h.toast();
    await page.fill('[data-f="inv.0.unit"]', "abc"); await page.press('[data-f="inv.0.unit"]', "Tab"); await page.waitForTimeout(80);
    await page.fill('[data-f="loan.rate"]', "250"); await page.press('[data-f="loan.rate"]', "Tab"); await page.waitForTimeout(80);
    const a = await h.app(id);
    expect(a.fin.inv[0].unit === before && a.fin.loan.rate !== 250 && /number from/.test(t1), `unit ${a.fin.inv[0].unit}, rate ${a.fin.loan.rate}`);
    return "Rejected: " + t1;
  });
test("TC-53", "Settings", "Impossible rule settings are refused", "FR-ADM-001",
  "Minimum age above maximum and a negative grant are rejected", async (page, h) => {
    await h.role("AD"); await h.nav("settings");
    await page.fill('[data-cfg="ageMin"]', "40"); await page.press('[data-cfg="ageMin"]', "Tab"); await page.waitForTimeout(80); const t1 = await h.toast();
    await page.fill('[data-cfg="maxGrant"]', "-5"); await page.press('[data-cfg="maxGrant"]', "Tab"); await page.waitForTimeout(80); const t2 = await h.toast();
    const c = await page.evaluate(() => DB.cfg);
    expect(c.ageMin === 18 && c.maxGrant === 900000, JSON.stringify(c));
    return `${t1} | ${t2}`;
  });
test("TC-54", "Usability", "Escape closes a dialog without saving", "Accessibility",
  "Dialog closes; status unchanged", async (page, h) => {
    const id = await h.register(); await h.open(id); await h.act("Withdraw application"); await page.keyboard.press("Escape"); await page.waitForTimeout(60);
    expect(!(await h.modalOpen()) && (await h.status(id)) === "REG", "dialog still open or status changed");
    return "Closed; status unchanged";
  });

// =====================================================================
// RUNNER
// =====================================================================
test("TC-55", "Registration v1.2", "Six districts and DS/GN audit list drive the location fields", "FR-REG-013",
  "6 districts; FO DS list = Vavuniya audit DS + Other; GN list filtered by DS", async (page, h) => {
    const n = await page.evaluate(() => DISTRICTS.length); expect(n === 6, "districts " + n);
    await h.role("FO"); await h.nav("register");
    const ds = await page.$$eval('[name="ds"] option', (o) => o.map((x) => x.textContent).filter(Boolean));
    expect(ds.length === 4 && ds.includes("Vavuniya South") && ds[ds.length - 1] === "Other (type)", "DS: " + ds.join("|"));
    expect(await page.isDisabled('[name="gn"]'), "GN enabled before DS");
    await page.selectOption('[name="ds"]', "Vavuniya South"); const gn = await page.$$eval('[name="gn"] option', (o) => o.length);
    expect(gn === 16, "GN options " + gn);
    return `6 districts; ${ds.length - 1} DS + Other; ${gn - 2} GN for Vavuniya South`;
  });
test("TC-56", "Registration v1.2", "Age is shown read-only and gender is not filled from the NIC", "FR-REG-014",
  "Age box read-only with value; gender stays blank", async (page, h) => {
    await h.role("FO"); await h.nav("register"); const nic = await h.makeNIC("2000-03-15", "Female");
    await page.fill('[name="nic"]', nic); await page.dispatchEvent('[name="nic"]', "input");
    const age = await page.inputValue('[name="age"]'), ro = await page.$eval('[name="age"]', (e) => e.readOnly), g = await page.inputValue('[name="gender"]');
    expect(/years/.test(age) && ro && g === "", `age ${age} ro ${ro} gender '${g}'`);
    return `Age "${age}" read-only; gender blank`;
  });
test("TC-57", "Registration v1.2", "Required fields follow the v1.2 list; optional fields can be blank", "FR-REG-001",
  "Saves with education, land and experience blank; blocks without consultancy answer", async (page, h) => {
    await h.role("FO"); await h.nav("register"); await page.click("[data-fill]");
    for (const n of ["landExtent", "experience"]) await page.fill(`[name="${n}"]`, ""); await page.selectOption('[name="edu"]', ""); await page.selectOption('[name="landOwn"]', "");
    await page.evaluate(() => document.querySelectorAll('[name="consult"]').forEach((r) => (r.checked = false)));
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(120);
    expect(/consultancy/.test(await h.toast()), "consultancy not required: " + (await h.toast()));
    await page.check('[name="consult"][value="No"]'); const before = await page.evaluate(() => DB.apps.length);
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(150);
    const a = await page.evaluate(() => DB.apps[DB.apps.length - 1]);
    expect((await page.evaluate(() => DB.apps.length)) === before + 1 && a.consultConsent === "No" && a.edu === "" && a.landExtent === "", "not saved as expected");
    return "Blocked without consultancy answer; saved with optional fields blank and consultancy No";
  });
test("TC-58", "Registration v1.2", "Other (type) for DS and category; typed GN is flagged; GN number kept", "FR-REG-013",
  "Record keeps typed values, gnFromList false, GN number stored", async (page, h) => {
    await h.role("FO"); await h.nav("register"); await page.click("[data-fill]");
    await page.selectOption('[name="ds"]', "__other__"); await page.fill('[name="dsOther"]', "Vavuniya North"); await page.fill('[name="gnOther"]', "Nedunkerny"); await page.fill('[name="gnNo"]', "230B");
    await page.selectOption('[name="category"]', "__other__"); await page.fill('[name="catOther"]', "Spice processing");
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(150);
    const a = await page.evaluate(() => DB.apps[DB.apps.length - 1]);
    expect(a.ds === "Vavuniya North" && a.gn === "Nedunkerny" && a.gnNo === "230B" && a.gnFromList === false && a.category === "Spice processing", JSON.stringify([a.ds, a.gn, a.gnNo, a.gnFromList, a.category]));
    const ov = await page.textContent("main"); expect(/typed; check against audit list/.test(ov), "flag not shown");
    return "Typed DS/GN/category stored; GN 230B; flagged on the record";
  });
test("TC-59", "Registration v1.2", "Business registration, financial plan and resource descriptions are saved and shown", "FR-REG-015, 016, 017",
  "Values on the record and on the overview", async (page, h) => {
    await h.role("FO"); await h.nav("register"); await page.click("[data-fill]");
    await page.selectOption('[name="bizReg"]', "Yes"); await page.fill('[name="bizRegNo"]', "DS/BR/2025/77"); await page.fill('[name="bizRegAuth"]', "Divisional Secretariat");
    await page.fill('[name="resExText"]', "2 cows and a shed");
    const hint = await page.textContent("#finHint"); expect(/2,000,000/.test(hint), "fin hint " + hint);
    await page.click('#regForm button[type="submit"]'); await page.waitForTimeout(150);
    const a = await page.evaluate(() => DB.apps[DB.apps.length - 1]);
    expect(a.bizRegNo === "DS/BR/2025/77" && a.finPlan && a.finPlan.sarp === 900000 && a.resExText === "2 cows and a shed", "values not saved");
    const ov = await page.textContent("main"); expect(/DS\/BR\/2025\/77/.test(ov) && /Proposed financial plan/.test(ov) && /2 cows and a shed/.test(ov), "overview missing values");
    return "Registration no., plan (SARP LKR 900,000) and description saved and shown";
  });
test("TC-60", "Capture import", "Import a capture backup: duplicates skipped, age out of band to review, rest as Draft with capture reference", "FR-REG-018",
  "Preview counts; records created; capture ref kept; import logged", async (page, h) => {
    const bk = fs.readFileSync(path.resolve(__dirname, "../capture-form/out/folder_backup.json"), "utf8"); const data = JSON.parse(bk);
    const recs = data.records.filter((r) => +r.dob.slice(0, 4) >= 1993 && +r.dob.slice(0, 4) <= 2006).slice(0, 12); const dupNic = await page.evaluate(() => DB.apps[0].nic); recs[3].nic = dupNic;
    recs[4].dob = "1980-01-15"; recs[4].nic = await h.makeNIC("1980-01-15", recs[4].gender || "Male");
    const f = path.join(OUT, "capture_small.json"); fs.writeFileSync(f, JSON.stringify({ ...data, records: recs }));
    await h.role("AD"); await h.nav("import"); await page.setInputFiles("#impFile", f); await page.waitForTimeout(300);
    const prev = await page.textContent("#impPreview"); expect(/12 records/.test(prev) && /1 will be skipped/.test(prev) && /1 go to eligibility review/.test(prev), "preview: " + prev.slice(0, 160));
    const before = await page.evaluate(() => DB.apps.length);
    await page.click("#impGo"); await page.click("#keyBtn"); await page.waitForTimeout(700);
    const after = await page.evaluate(() => DB.apps.length); expect(after === before + 11, `created ${after - before}`);
    const imp = await page.evaluate(() => DB.apps.slice(-11)); expect(imp.every((a) => a.captureRef && /^L1-\d{3}$/.test(a.captureRef)), "capture refs missing");
    expect(imp.filter((a) => a.status === "ELR").length === 1 && imp.filter((a) => a.status === "DRF").length === 10, "statuses wrong");
    const logged = await page.evaluate(() => DB.audit.some((x) => /Imported pre-registration capture/.test(x.action))); expect(logged, "not logged");
    return `11 imported (10 Draft, 1 eligibility review), 1 duplicate skipped; refs kept; logged`;
  });
test("TC-61", "Capture import", "Password-protected capture backup opens only with the right password", "FR-REG-018, SEC-DAT",
  "Wrong password refused; right password shows preview", async (page, h) => {
    const bk = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../capture-form/out/folder_backup.json"), "utf8"));
    const enc = await page.evaluate(async (payload) => { const pw = "Sarp-2026!x"; const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)); const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]); const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)))); const b = (u) => { let s = ""; u.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); }; return { app: "sarp-yed-capture", v: 2, enc: { salt: b(salt), iv: b(iv), data: b(ct), iter: 250000 } }; }, { ...bk, records: bk.records.slice(0, 5) });
    const f = path.join(OUT, "capture_enc.json"); fs.writeFileSync(f, JSON.stringify(enc));
    await h.role("AD"); await h.nav("import"); await page.setInputFiles("#impFile", f); await page.waitForTimeout(200);
    await page.fill("#pw", "wrong"); await h.ok(); await page.waitForTimeout(400); expect(/Wrong password/.test(await h.toast()), "wrong pw accepted");
    await page.fill("#pw", "Sarp-2026!x"); await h.ok(); await page.waitForTimeout(600);
    expect(/5 records/.test(await page.textContent("#impPreview")), "preview not shown");
    return "Wrong password refused; correct password shows 5-record preview";
  });
test("TC-62", "Master data", "13 business categories in the registration form", "Section 1",
  "13 categories plus Other (type)", async (page, h) => {
    await h.role("FO"); await h.nav("register"); const c = await page.$$eval('[name="category"] option', (o) => o.map((x) => x.textContent).filter(Boolean));
    expect(c.length === 14 && c.includes("Value addition") && c[13] === "Other (type)", c.join("|"));
    return "13 categories + Other";
  });
(async () => {
  const only = process.argv[2] ? process.argv[2].split(",") : null;
  const browser = await chromium.launch();
  const results = [];
  for (const t of T) {
    if (only && !only.includes(t.id)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("dialog", (d) => d.dismiss());
    const t0 = Date.now(); let status = "Pass", actual = "";
    try {
      await page.goto(APP); await page.waitForTimeout(100);
      actual = await t.fn(page, H(page));
      if (errors.length) { status = "Fail"; actual += " | JS errors: " + errors.join("; "); }
    } catch (e) {
      status = "Fail"; actual = (e instanceof Fail ? "" : "ERROR: ") + e.message.split("\n")[0];
      try { await page.screenshot({ path: path.join(OUT, t.id + "_fail.png") }); } catch (_) {}
    }
    const r = { id: t.id, area: t.area, title: t.title, reqs: t.reqs, expected: t.expected, actual: String(actual), status, ms: Date.now() - t0 };
    results.push(r); console.log(`${r.status === "Pass" ? "PASS" : "FAIL"}  ${t.id}  ${t.title}  —  ${r.actual}`);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ run: new Date().toISOString(), results }, null, 2));
  const pass = results.filter((r) => r.status === "Pass").length;
  console.log(`\n${pass}/${results.length} passed`);
})();
