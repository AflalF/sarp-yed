const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, PageBreak, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, VerticalAlign, TabStopType, PageOrientation,
} = require("docx");

const W = 9026; // A4 content width (DXA) with 1" margins
const C = { forest: "1B5E20", green: "2E7D32", ink: "1C2B1E", muted: "5B6B5D", line: "C9D3C7", tint: "EEF6EB", grey: "F3F5F2", amber: "FFF3E2", blue: "EAF1FB", red: "FCECEC", purple: "F2EDF8" };
const FONT = "Calibri";
const DIR = __dirname;
const IMG = (n) => fs.readFileSync(path.join(DIR, n));

// ---------- text helpers ----------
function runs(str, base = {}) {
  const out = [];
  String(str).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) out.push(new TextRun(Object.assign({ text: part.slice(2, -2), bold: true }, base)));
    else out.push(new TextRun(Object.assign({ text: part }, base)));
  });
  return out;
}
const body = [];
const P = (t, o = {}) => body.push(new Paragraph(Object.assign({ children: runs(t, o.run || {}), spacing: { after: 120, line: 276 } }, o.para || {})));
const H1 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true }));
const H2 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }));
const H3 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }));
const BL = (items, lvl = 0) => items.forEach((t) => body.push(new Paragraph({ numbering: { reference: "bul", level: lvl }, children: runs(t), spacing: { after: 60, line: 264 } })));
const NL = (items, ref = "num") => items.forEach((t) => body.push(new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 264 } })));
const SP = () => body.push(new Paragraph({ children: [], spacing: { after: 60 } }));

const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, w, o = {}) {
  const paras = (Array.isArray(text) ? text : [text]).map((t) => new Paragraph({ children: runs(t, Object.assign({ size: o.size || 18, color: o.color || C.ink, bold: o.bold }, {})), spacing: { after: 20, line: 240 }, alignment: o.align || AlignmentType.LEFT }));
  return new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders, shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER, columnSpan: o.span });
}
// fr = fractions (sum 1); rows = arrays of strings
function TBL(headers, rows, fr, o = {}) {
  const ws = fr.map((f) => Math.round(f * W));
  ws[ws.length - 1] = W - ws.slice(0, -1).reduce((a, b) => a + b, 0);
  const size = o.size || 18;
  const trs = [];
  if (headers) trs.push(new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, ws[i], { fill: o.hfill || C.forest, color: "FFFFFF", bold: true, size })) }));
  rows.forEach((r, ri) => {
    const fill = o.zebra === false ? undefined : (ri % 2 ? C.grey : undefined);
    const isTotal = o.totalLast && ri === rows.length - 1;
    trs.push(new TableRow({ children: r.map((c, i) => cell(c, ws[i], { fill: isTotal ? C.tint : fill, size, bold: isTotal || (o.boldFirst && i === 0), align: o.align && o.align[i] })) }));
  });
  body.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, rows: trs }));
  body.push(new Paragraph({ children: [], spacing: { after: 120 } }));
}
function REQ(rows) { TBL(["ID", "Requirement", "Priority"], rows, [0.13, 0.77, 0.10], { align: [null, null, AlignmentType.CENTER] }); }
function NOTE(text, fill = C.tint, label = "Note") {
  body.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: fill }, bottom: { style: BorderStyle.SINGLE, size: 4, color: fill }, left: { style: BorderStyle.SINGLE, size: 4, color: fill }, right: { style: BorderStyle.SINGLE, size: 4, color: fill } }, margins: { top: 120, bottom: 120, left: 160, right: 160 }, children: [new Paragraph({ children: [new TextRun({ text: label + ":  ", bold: true, color: C.forest, size: 20 }), ...runs(text, { size: 20 })], spacing: { after: 0, line: 264 } })] })] })] }));
  body.push(new Paragraph({ children: [], spacing: { after: 120 } }));
}
function FIG(file, wIn, caption) {
  const buf = IMG(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  let wpx = wIn * 96, hpx = wpx * h / w;
  const maxH = 8.6 * 96; if (hpx > maxH) { hpx = maxH; wpx = hpx * w / h; }
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: buf, transformation: { width: Math.round(wpx), height: Math.round(hpx) }, altText: { title: caption, description: caption, name: caption } })], spacing: { after: 60 } }));
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: caption, italics: true, size: 18, color: C.muted })], spacing: { after: 200 } }));
}
const M = "Must", S = "Should", Co = "Could";

// =====================================================================
// COVER
// =====================================================================
const cover = [];
{
  const logo = IMG("logo_full.png"); const lw = logo.readUInt32BE(16), lh = logo.readUInt32BE(20);
  cover.push(new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 260, height: Math.round(260 * lh / lw) }, altText: { title: "Indo-Lanka logo", description: "Indo-Lanka Greenhouse and Agri Solutions logo", name: "logo" } })], spacing: { before: 400, after: 900 } }));
  cover.push(new Paragraph({ children: [new TextRun({ text: "SARP YED Management System", bold: true, size: 56, color: C.forest, font: FONT })], spacing: { after: 160 } }));
  cover.push(new Paragraph({ children: [new TextRun({ text: "Functional and Technical Specification", size: 36, color: C.ink, font: FONT })], spacing: { after: 120 } }));
  cover.push(new Paragraph({ children: [new TextRun({ text: "Workflow, functional requirements, data protection (PDPA), cyber security, architecture and capacity for 1,600 beneficiaries", size: 22, color: C.muted, font: FONT })], spacing: { after: 700 } }));
  const kv = [["Programme", "Smallholder Agribusiness and Resilience Project (SARP): Youth Enterprise Development (YED)"], ["Prepared for", "Indo-Lanka Greenhouse and Agri Solutions (Pvt) Ltd, technical consultants to SARP"], ["Document version", "1.2, revised draft for review"], ["Date", "16 November 2026"], ["Classification", "Confidential: for the project team and appointed developers"]];
  const ws = [2400, W - 2400];
  cover.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, rows: kv.map((r) => new TableRow({ children: [cell(r[0], ws[0], { bold: true, fill: C.tint, size: 20 }), cell(r[1], ws[1], { size: 20 })] })) }));
  const ban = IMG("banner.png"); const bw = ban.readUInt32BE(16), bh = ban.readUInt32BE(20);
  cover.push(new Paragraph({ children: [new ImageRun({ type: "png", data: ban, transformation: { width: 602, height: Math.round(602 * bh / bw) }, altText: { title: "Greenhouse banner", description: "Greenhouses and farmland", name: "banner" } })], spacing: { before: 900 } }));
}

// =====================================================================
// DOCUMENT CONTROL + TOC
// =====================================================================
const front = [];
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Document control")], pageBreakBefore: true }));
{
  const sub = (t) => front.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }));
  const mk = (headers, rows, fr) => { const ws = fr.map((f) => Math.round(f * W)); ws[ws.length - 1] = W - ws.slice(0, -1).reduce((a, b) => a + b, 0); front.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, ws[i], { fill: C.forest, color: "FFFFFF", bold: true })) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, ws[i])) }))] })); front.push(new Paragraph({ children: [], spacing: { after: 160 } })); };
  sub("Version history");
  mk(["Version", "Date", "Description"], [["1.0", "15 November 2026", "First full specification. Built from the SARP YED process deck (v2, 20 slides) and the System Capacity Analysis deck, rescaled from 600 to 1,600 beneficiaries, with PDPA and cyber security requirements added."], ["1.1", "15 November 2026", "Revised after review: document deadlines by stage gate; eligibility review instead of automatic ineligibility; separate authority to record SARP Committee decisions; AI payload allow-list, single zero-retention rule and payload test; phishing-resistant MFA (WebAuthn/FIDO2); isolated recovery environment; clarification handling after freelancer access ends; storage total 950 GB; 24-week plan with go-live week; one security release criterion; decision deadlines."], ["1.2", "16 November 2026", "Registration form changes requested by Indo-Lanka (points 01–11): six programme districts with dependent DS and approved GN lists (GN now mandatory); age shown read-only; gender entered manually; business registration; optional proposed financial plan and resource tables; education, land, experience and all existing-business fields made optional; the AI question removed from registration and replaced by a separate Indo-Lanka consultancy consent; import of pre-registration capture data (FR-REG-013 to FR-REG-018); decisions 15 and 16 added; free-text descriptions added to both resource tables; DS/GN audit list (17 November 2026) adopted, with Other (type) on every list; 13 business categories confirmed."]], [0.12, 0.2, 0.68]);
  sub("Review and approval");
  mk(["Role", "Organisation", "Name", "Signature", "Date"], [["Prepared by", "", "", "", ""], ["Reviewed by", "Indo-Lanka Greenhouse and Agri Solutions", "", "", ""], ["Approved by", "SARP Project Management Unit", "", "", ""], ["Data protection review", "Data Protection Officer (controller)", "", "", ""]], [0.2, 0.32, 0.18, 0.15, 0.15]);
  sub("Source documents");
  mk(["Ref.", "Document"], [
    ["S1", "SARP YED Management System: System design and SOPs, revised edition (20 slides, November 2026)"],
    ["S2", "SARP YED Management System: System Capacity Analysis (4 slides): user counts, document storage, server specification, backup requirements"],
    ["S3", "Personal Data Protection Act, No. 9 of 2022, as amended by the Personal Data Protection (Amendment) Act, No. 22 of 2025"],
    ["S4", "Extraordinary Gazette No. 2498/16 of 22 July 2026 (PDPA commencement order) and Data Protection Authority Circular No. 01/2026 (PDPA in the public sector)"],
    ["S5", "Sri Lanka CERT: Web Application Security Guidelines and Website Security Guidelines for Government Organizations (2022); Minimum Information Security Standards for Government Organizations; Information and Cyber Security Policy for Government Organizations"],
    ["S6", "OWASP Application Security Verification Standard (ASVS) 4.0.3, Level 2; OWASP Top 10"],
  ], [0.08, 0.92]);
}
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Contents")], pageBreakBefore: true }));
front.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
front.push(new Paragraph({ children: [new TextRun({ text: "If the contents list is empty, right-click it in Word and choose Update Field.", italics: true, size: 18, color: C.muted })] }));

// =====================================================================
// 1 INTRODUCTION
// =====================================================================
H1("1  Introduction");
H2("1.1  Purpose");
P("This document is the single reference for building the SARP YED Management System. It turns the agreed process (SOP 01 to SOP 05, with SOP 06 planned for Phase 2) into functional requirements a developer can build and test against, and sets the technical, data protection and cyber security requirements the system must meet as a government-related platform holding citizens' personal data.");
P("Every requirement has an ID (for example **FR-REG-004**) so that design, test cases, change requests and acceptance can be traced back to it.");
H2("1.2  Scope");
P("**In scope (Phase 1):**");
BL([
  "Web-based system covering the full workflow from community outreach and registration to SARP decision (Steps 1 to 10, SOP 01 to SOP 05).",
  "User, role and access management with multi-factor authentication; government official access for review stages.",
  "Interview preparation, interview form, site verification and scorecard (SOP 02).",
  "Proposal preparation for SARP Sections 2 to 10, including AI-assisted drafting and a calculated financial model (SOP 03).",
  "Document management, verification, approval workflow, final application generation (PDF, Word, Excel) and SARP decision tracking (SOP 04, SOP 05).",
  "Dashboards, reports, notifications (SMS and email), audit trail, master data administration.",
  "PDPA compliance features (consent, data subject requests, retention, breach handling support) and the security controls in Section 9.",
  "Hosting set-up, backup and recovery, security testing and Sri Lanka CERT assessment support, training and go-live.",
]);
P("**Out of scope (Phase 1):** SOP 06 post-approval monitoring (outlined in Section 5.13 for Phase 2), payment or disbursement processing, integration with SARP or Ministry systems (submission is recorded, not transmitted), native mobile apps, and offline data capture.");
H2("1.3  Intended readers");
TBL(["Reader", "Use of this document"], [
  ["SARP Project Management Unit", "Approve scope, confirm open decisions (Section 15), act as data controller"],
  ["Indo-Lanka management", "Confirm operating process, roles and service levels"],
  ["Development team", "Build, configure and unit-test against the requirement IDs"],
  ["Test team / UAT users", "Write and run test cases; sign off acceptance"],
  ["Security assessors (incl. Sri Lanka CERT)", "Review controls before production release"],
  ["Data Protection Officer", "Review PDPA design, DPIA and retention schedule"],
], [0.32, 0.68]);
H2("1.4  Definitions and abbreviations");
TBL(["Term", "Meaning"], [
  ["SARP", "Smallholder Agribusiness and Resilience Project, implemented by the Ministry of Agriculture with IFAD financing"],
  ["YED", "Youth Enterprise Development: the SARP component this system supports"],
  ["SOP", "Standard operating procedure. SOP 01 to SOP 05 cover Steps 1 to 10 of the workflow"],
  ["Beneficiary / applicant", "A young person registered for a YED grant. Called an applicant until SARP approval"],
  ["Application", "The record that follows one beneficiary through the workflow (one per beneficiary)"],
  ["Panel", "Senior Team members (minimum two) who interview and score an applicant"],
  ["PDPA", "Personal Data Protection Act, No. 9 of 2022, as amended by Act No. 22 of 2025"],
  ["DPA", "Data Protection Authority of Sri Lanka"],
  ["DPO", "Data Protection Officer"],
  ["DPIA", "Data protection impact assessment"],
  ["MFA", "Multi-factor authentication"],
  ["RPO / RTO", "Recovery point objective (maximum data loss) / recovery time objective (maximum downtime)"],
  ["VAPT", "Vulnerability assessment and penetration test"],
  ["Gate (G1–G4)", "Workflow point where required documents must be uploaded (G1–G3) or verified (G4); see Section 6.7"],
  ["SARP PMU Officer", "Officer designated by the SARP PMU to record Project Committee decisions in the system"],
  ["WebAuthn / FIDO2", "Phishing-resistant login standard using a security key or device passkey"],
  ["Must / Should / Could", "Requirement priority: Must = required for go-live; Should = expected unless agreed otherwise; Could = optional if time allows"],
], [0.25, 0.75]);
H2("1.5  What has changed since earlier planning");
TBL(["Item", "Earlier figure", "This specification", "Effect"], [
  ["Beneficiaries", "600 (200 per district, 3 districts)", "**1,600**", "Storage, backup and workload recalculated (Section 11). District split and quotas become configurable."],
  ["Freelancers", "15 (process deck)", "**20** (capacity deck)", "About 80 proposals per freelancer"],
  ["Government officials", "Decisions recorded by Indo-Lanka", "**4 named logins**", "New Government Official role (own review stage) and SARP PMU Officer role (Committee decisions)"],
  ["Named users", "Not set", "**41** (12 + 20 + 5 + 4)", "Designed for up to 100 named users and 30 concurrent"],
  ["Document storage", "100 GB", "**250 GB** recommended", "See Section 11.2"],
  ["Backup storage", "250 GB", "**500 GB** recommended, off-site", "See Section 11.5"],
  ["Interview data", "Basic interview fields", "Full form A–F, site visit, scorecard", "From the revised process deck"],
], [0.18, 0.24, 0.22, 0.36]);

// =====================================================================
// 2 PROGRAMME CONTEXT
// =====================================================================
H1("2  Programme context and system overview");
H2("2.1  Programme");
P("SARP is a Government of Sri Lanka project implemented by the Ministry of Agriculture and co-financed by IFAD. Its Youth Enterprise Development component gives grants to young people to start or scale greenhouse and agri-based businesses. Indo-Lanka Greenhouse and Agri Solutions (Pvt) Ltd acts as technical consultant: it runs community outreach, registers and interviews applicants, prepares business proposals through freelancers, verifies documents and submits applications to SARP.");
H2("2.2  Key programme figures");
TBL(["Measure", "Value", "Basis"], [
  ["Total beneficiaries", "1,600", "Revised programme target"],
  ["SARP grant per project", "Up to LKR 900,000", "Maximum grant; enforced by the funding check (Section 6.5)"],
  ["Total project value per beneficiary", "LKR 2,000,000", "Grant + own contribution + loan (fixed value or ceiling to be confirmed)"],
  ["Total grant value", "LKR 1.44 billion", "900,000 × 1,600"],
  ["Total project value", "LKR 3.2 billion", "2,000,000 × 1,600"],
  ["Districts", "Configurable list", "Six programme districts: Anuradhapura, Vavuniya, Mannar, Puttalam, Kurunegala and Matale; the split of 1,600 between them is to be confirmed (decision 1)"],
], [0.32, 0.25, 0.43]);
H2("2.3  System objectives");
NL([
  "Run one fair, transparent and auditable process from registration to SARP decision for 1,600 applicants.",
  "Capture each piece of data once, against a single beneficiary ID, and reuse it in every later step and output.",
  "Cut proposal preparation time through AI-assisted drafting and an automatic financial model, while keeping people responsible for the final content.",
  "Give management and SARP live visibility of the pipeline, quotas, workloads and decisions.",
  "Protect applicants' personal data in line with the PDPA, and meet Sri Lanka CERT security guidance for government web applications.",
]);
H2("2.4  Solution overview");
TBL(["Module", "Covers", "Primary users"], [
  ["M1 Access and users", "Login, MFA, roles, data scope, user administration", "All; Admin"],
  ["M2 Registration (SOP 01)", "Steps 1–2, Section 1, eligibility and duplicate checks, ID issue, consent", "Field Officer"],
  ["M3 Interview (SOP 02)", "Step 3: interview pack, scheduling, form A–F, site visit, scorecard, decision", "Senior Team, Field Officer"],
  ["M4 Proposal (SOP 03)", "Steps 4–5: assignment, Sections 2–10, AI drafting, financial model, Section 10", "Senior Team, Freelancer"],
  ["M5 Documents (SOP 04)", "Steps 6–7: checklist, uploads, versions, verification, corrections", "All preparers; Reviewer"],
  ["M6 Approval and submission (SOP 05)", "Steps 8–10: approval, final application generation, submission, external review tracking", "Management, SARP Liaison, Government Official, SARP PMU Officer"],
  ["M7 Dashboards and reports", "Pipeline, quotas, workload, turnaround, exports", "Management, Senior Team"],
  ["M8 Notifications", "SMS to applicants; email and in-app alerts to users", "System"],
  ["M9 Administration", "Master data, configuration, templates, audit log", "Admin"],
  ["M10 Data protection", "Consent register, data subject requests, retention and anonymisation", "DPO"],
], [0.27, 0.5, 0.23]);

// =====================================================================
// 3 USERS AND ROLES
// =====================================================================
H1("3  Users, roles and access control");
H2("3.1  User capacity");
P("Named user numbers come from the System Capacity Analysis (S2). The system must support at least **100 named users** and **30 concurrent users** (planning target) without redesign.");
TBL(["User group", "Named logins", "Roles held", "Workload at 1,600 beneficiaries"], [
  ["Field Officers", "12", "Field Officer", "About 133 registrations each"],
  ["Freelancers", "20", "Freelancer", "About 80 proposals each"],
  ["Senior management and administrators", "5", "Senior Team, Reviewer, Management, SARP Liaison, Admin, DPO (combined)", "Interview panels need at least two people, so panel load must be planned"],
  ["Government officials", "4", "Government Official (line agency, district / provincial) and SARP PMU Officer", "Proposed split: 3 review-stage officials + 1 PMU officer (to confirm)"],
  ["Total", "41", "", "30 concurrent users (planning target)"],
], [0.28, 0.13, 0.32, 0.27], { totalLast: true });
NOTE("Five senior staff will hold several roles each. The system allows one person to hold several roles but enforces segregation of duties (FR-UM-009): nobody can approve an application they prepared, verified or interviewed alone. With 1,600 interviews, the Senior Team pool may need to grow; this is listed in Section 15.", C.amber, "Capacity note");
H2("3.2  Role definitions");
TBL(["Role", "Code", "Responsibilities"], [
  ["Field Officer", "FO", "Community outreach, registration (SOP 01), uploading early documents, site verification visits (SOP 02 part D). Sees only applicants in assigned districts."],
  ["Senior Team", "ST", "Interview scheduling, interviews and scoring as a panel member, shortlisting decision, freelancer assignment."],
  ["Freelancer", "FL", "Prepares Sections 2–10 for assigned applicants only, uploads documents, responds to corrections."],
  ["Reviewer (QA)", "RV", "Verifies documents and proposal quality (SOP 04); returns for correction or releases for approval."],
  ["Management", "MG", "Approves or returns applications (Step 8); views all dashboards; authorises personal data exports."],
  ["SARP Liaison", "SL", "Records submission to SARP and SARP review stages and decisions when officials do not record them directly."],
  ["Government Official", "GO", "Line agency or district / provincial officer. Views submitted applications in their scope and records the outcome and comments of their own review stage only. Cannot record the SARP Project Committee decision."],
  ["SARP PMU Officer", "PMU", "Officer designated by the SARP PMU to record SARP Project Committee decisions and clarification requests, with committee evidence (FR-APP-011). Views all submitted applications."],
  ["System Administrator", "AD", "Users, roles, master data, configuration, templates, technical operations. No routine access to applicant content."],
  ["Data Protection Officer", "DPO", "Consent register, data subject requests, retention runs, breach register. Role flag held by a named manager."],
  ["Applicant", "—", "No login in Phase 1. Receives SMS updates in their preferred language."],
], [0.2, 0.08, 0.72]);
H2("3.3  Permission matrix");
P("C = create and edit, U = upload, A = approve or decide, V = view, — = no access. Scope rules in Section 3.4 apply on top of this matrix.");
TBL(["Function", "FO", "ST", "FL", "RV", "MG", "SL", "GO", "PMU", "AD", "DPO"], [
  ["Register applicant (SOP 01)", "C", "V", "V*", "V", "V", "V", "—", "—", "—", "V"],
  ["Eligibility review", "C (correct data)", "A", "—", "V", "A (reopen)", "—", "—", "—", "—", "V"],
  ["Schedule interview", "V", "C", "—", "V", "V", "—", "—", "—", "—", "—"],
  ["Interview form A–F, scorecard", "C (D only)", "C/A", "V*", "V", "V", "—", "—", "—", "—", "—"],
  ["Assign or reassign freelancer", "—", "C", "—", "V", "V", "—", "—", "—", "—", "—"],
  ["Proposal Sections 2–10", "—", "V", "C*", "V + comment", "V", "V", "V**", "V", "—", "—"],
  ["Upload documents", "U", "U", "U*", "U", "V", "V", "V**", "V", "—", "—"],
  ["Verify documents and proposal", "—", "—", "—", "A", "V", "—", "—", "—", "—", "—"],
  ["Management approval", "—", "—", "—", "—", "A", "—", "—", "—", "—", "—"],
  ["Generate final application", "—", "—", "—", "—", "C", "V", "V**", "V", "—", "—"],
  ["Record submission to SARP", "—", "—", "—", "—", "V", "C", "—", "V", "—", "—"],
  ["Record own review stage", "—", "—", "—", "—", "V", "C", "C**", "C", "—", "—"],
  ["Record SARP Committee decision or clarification", "—", "—", "—", "—", "A (confirms SL entry)", "C (with evidence)", "—", "C", "—", "—"],
  ["Dashboards", "Own district", "All", "Own", "All", "All", "All", "Scope**", "All submitted", "System", "Summary"],
  ["Export personal data", "—", "—", "—", "—", "A", "—", "—", "—", "—", "A"],
  ["Users, roles, master data", "—", "—", "—", "—", "V", "—", "—", "—", "C", "—"],
  ["Audit log", "—", "—", "—", "—", "V", "—", "—", "—", "V", "V"],
  ["Consent register, data subject requests", "—", "—", "—", "—", "V", "—", "—", "—", "—", "C"],
], [0.2, 0.08, 0.07, 0.07, 0.08, 0.09, 0.08, 0.07, 0.08, 0.07, 0.11], { size: 15, boldFirst: true });
P("* Assigned applicants only.  ** Submitted applications within the official's agency or district scope only. PMU = SARP PMU Officer.", { run: { size: 18, italics: true, color: C.muted } });
H2("3.4  Data-scope rules");
REQ([
  ["FR-UM-010", "Field Officers see only applicants in the districts assigned to their user profile.", M],
  ["FR-UM-011", "Freelancers see only applicants assigned to them, from assignment until the record is locked; afterwards read-only for 30 days, then no access. Access is restored only when the Senior Team gives them a correction task (FR-APP-008).", M],
  ["FR-UM-012", "Government Officials see only applications with status Submitted to SARP or later, within their agency and district scope, and can record only their own agency's review stage. Only the SARP PMU Officer (or the SARP Liaison with evidence and Management confirmation) can record a Project Committee decision.", M],
  ["FR-UM-013", "System Administrators cannot open applicant content in the normal user interface. Emergency access needs a second approver (Management) and is logged as a break-glass event.", M],
  ["FR-UM-014", "Scope checks are enforced on the server for every request (user interface, API, export and file download), not only by hiding menu items.", M],
]);

// =====================================================================
// 4 WORKFLOW
// =====================================================================
body.push("__LS_START__");
H1("4  End-to-end workflow");
H2("4.1  Process overview");
P("The workflow has 10 steps across 5 SOPs. Figure 1 is the process flow from the SARP YED process deck: each step shows its SOP, the main activity and what the system records. The same step and SOP numbers are used throughout this document and in the system's status codes.");
FIG("dg/flow_pictorial.png", 9.6, "Figure 1: Process flow at a glance, outreach to SARP decision (from the SARP YED process deck)");
body.push("__LS_END__");
P("Figure 2 is the detailed flowchart the system implements, including decision points and return loops. Solid arrows show the main path; dashed arrows show return loops.");
FIG("dg/flow.png", 6.3, "Figure 2: Detailed workflow with decisions and return loops");
H2("4.2  Step-by-step workflow");
TBL(["Step", "SOP", "Actor", "What happens", "System action", "Status after"], [
  ["1", "01", "Field Officer", "Awareness meeting; interested youth identified; registration started", "Opens new record; district limited to user scope", "Draft"],
  ["2", "01", "Field Officer", "Section 1 details captured; consent signed and uploaded", "Validates fields, age, NIC uniqueness, district quota; issues beneficiary ID", "Registered, or Eligibility review if a check fails"],
  ["3a", "02", "Senior Team", "Interview pack reviewed; date, venue and panel set", "Prints pack from SOP 01 data; SMS reminder to applicant", "Interview scheduled"],
  ["3b", "02", "Panel, Field Officer", "Interview held (form A–F); site visit done", "Captures form, GPS, photos; checks completeness", "Interviewed"],
  ["3c", "02", "Panel", "Each member scores; chair records decision", "Calculates weighted score and suggested band", "Shortlisted, On hold or Not shortlisted"],
  ["4", "03", "Senior Team", "Freelancer chosen; target date set", "Shows workload; notifies freelancer", "Assigned to freelancer"],
  ["5", "03", "Freelancer", "Sections 2–10 drafted, edited and confirmed", "AI drafts 2–7; calculates Sections 8–9; runs funding check", "Proposal in progress"],
  ["6", "04", "All preparers", "Supporting documents uploaded", "Checklist status, versioning, virus scan", "(no change)"],
  ["7", "04", "Reviewer", "Documents and proposal checked", "Completeness check; correction loop", "Under verification, then Pending management approval or Returned for correction"],
  ["8", "05", "Management", "Full proposal reviewed and approved or returned", "Pre-approval checks; segregation-of-duties check", "Approved for submission or Returned for correction"],
  ["9", "05", "System", "Final application generated", "Builds PDF, Word, Excel and document pack; locks record", "Approved for submission (locked)"],
  ["10", "05", "SARP Liaison, Government Official, PMU Officer", "Submitted to SARP; review stages and decision recorded", "Records dates, references, comments; notifies applicant", "Submitted, Under SARP review, SARP approved or SARP rejected"],
], [0.06, 0.06, 0.14, 0.27, 0.27, 0.2], { size: 16 });
H2("4.3  Application status model");
TBL(["Code", "Status", "SOP", "Meaning", "Who can edit the record"], [
  ["DRF", "Draft", "01", "Registration started, not yet saved as complete", "Field Officer"],
  ["REG", "Registered", "01", "Eligibility passed, beneficiary ID issued", "Field Officer"],
  ["ELR", "Eligibility review", "01", "A check failed; Field Officer corrects data or Senior Team decides", "Field Officer (data), Senior Team (decision)"],
  ["INE", "Ineligible", "01", "Senior Team confirmed ineligibility with reason (closed; can be reopened on evidence)", "Senior Team + Management (reopen only)"],
  ["ISC", "Interview scheduled", "02", "Date, venue and panel set", "Senior Team"],
  ["INT", "Interviewed", "02", "Interview form saved; scoring in progress", "Panel"],
  ["HLD", "On hold", "02", "More information needed; returns to scheduling", "Senior Team"],
  ["SHL", "Shortlisted", "02", "Approved to move to proposal preparation", "Senior Team"],
  ["NSL", "Not shortlisted", "02", "Declined with reason (closed)", "Nobody"],
  ["ASG", "Assigned to freelancer", "03", "Freelancer and target date set", "Senior Team, Freelancer"],
  ["PIP", "Proposal in progress", "03", "Sections 2–10 being prepared", "Freelancer"],
  ["UVR", "Under verification", "04", "Reviewer checking", "Reviewer"],
  ["RFC", "Returned for correction", "03", "Sent back by Reviewer, Management or SARP", "Freelancer"],
  ["PMA", "Pending management approval", "05", "Verified and waiting for approval", "Management"],
  ["AFS", "Approved for submission", "05", "Approved; final package generated; record locked", "Nobody (Admin reopen only)"],
  ["SUB", "Submitted to SARP", "05", "Submission date and reference recorded", "SARP Liaison"],
  ["USR", "Under SARP review", "05", "At least one external review stage recorded", "SARP Liaison, Government Official (own stage), SARP PMU Officer"],
  ["SAP", "SARP approved", "05", "Approved by SARP Project Committee; moves to SOP 06 in Phase 2", "Nobody"],
  ["SRJ", "SARP rejected", "05", "Rejected with reason (closed)", "Nobody"],
  ["WDN", "Withdrawn", "Any", "Applicant not proceeding (closed)", "Nobody"],
], [0.08, 0.22, 0.07, 0.4, 0.23], { size: 16 });
H2("4.4  Status transition rules");
P("The system must allow only the transitions below. Each transition writes a status history record (from, to, user, date and time, comment).");
TBL(["From", "To", "Trigger", "By", "Pre-conditions checked by the system"], [
  ["DRF", "REG", "Complete registration", "FO", "All mandatory Section 1 fields; consent recorded; items due by gate G1 uploaded (NIC copy, consent form); age within youth band; NIC unique; district quota not exceeded (or override reason)"],
  ["DRF", "ELR", "Complete registration", "System", "An eligibility check (E1 age, E3 NIC unique) failed; failed checks shown; no decision made yet"],
  ["ELR", "REG", "Correct and re-check", "FO", "Data-entry error corrected (e.g. wrong NIC or date of birth); all checks now pass; correction logged"],
  ["ELR", "INE", "Confirm ineligible", "ST", "Senior Team member reviews the evidence and confirms with reason; applicant told by SMS how to ask for a review"],
  ["INE", "ELR", "Reopen", "ST + MG", "New evidence or proven data error; reason recorded"],
  ["REG, HLD", "ISC", "Schedule interview", "ST", "Date, time, venue; at least two panel members; panel members not related to applicant (declaration)"],
  ["ISC", "INT", "Save interview form", "Panel", "Sections A–F complete; site visit done or waived with reason"],
  ["INT", "SHL / HLD / NSL", "Record decision", "Panel chair", "All panel members have submitted scores; override of suggested band needs a written reason; Shortlisted only when items due by gate G2 are uploaded (land document, site photos)"],
  ["SHL", "ASG", "Assign freelancer", "ST", "Freelancer active; open assignments below the configured cap"],
  ["ASG", "PIP", "Freelancer starts work", "System", "First save by the freelancer"],
  ["PIP, RFC", "UVR", "Submit for verification", "FL", "Sections 2–10 confirmed; funding check passed; every applicable checklist item due by gate G3 uploaded (Section 6.7)"],
  ["UVR", "RFC", "Return", "RV", "Comment mandatory, linked to section or document"],
  ["UVR", "PMA", "Release", "RV", "Every applicable checklist item Verified (gate G4), including bank account confirmation and signed declaration; required Section 10 recommendations Received"],
  ["PMA", "AFS", "Approve", "MG", "Pre-approval checks pass; approver did not prepare, verify or solely interview this application; bank details verified; confirmed with WebAuthn step-up"],
  ["PMA", "RFC", "Return", "MG", "Comment mandatory"],
  ["AFS", "SUB", "Record submission", "SL", "Final package generated; submission date and SARP reference entered"],
  ["SUB, USR", "USR", "Record review stage", "SL / GO (own stage) / PMU", "Stage, date, outcome and comment; a Government Official can record only their own agency's stage"],
  ["USR", "RFC", "SARP clarification", "PMU / SL", "Clarification text and source; submitted package kept read-only; new version created; Senior Team receives a correction task (FR-APP-008)"],
  ["USR", "SAP / SRJ", "Record SARP Committee decision", "PMU, or SL + MG confirmation", "Committee meeting date, minute or reference number, signed minutes or decision letter uploaded, approved grant amount; reason for rejection (FR-APP-011)"],
  ["Any open", "WDN", "Withdraw", "FO / ST", "Reason and date; applicant request recorded"],
], [0.1, 0.12, 0.17, 0.1, 0.51], { size: 16 });
H2("4.5  Service levels and reminders");
P("Default target times below are configurable by the Admin. The dashboard flags items approaching (amber) or past (red) their target.");
TBL(["Stage", "Default target", "Reminder"], [
  ["Eligibility review decision", "5 working days", "Senior Team at day 3"],
  ["Registration to interview", "14 calendar days", "Senior Team at day 10"],
  ["Interview to panel decision", "3 working days", "Panel chair at day 2"],
  ["Assignment to submission for verification", "14 calendar days", "Freelancer 2 days before; Senior Team when overdue"],
  ["Verification", "3 working days", "Reviewer at day 2"],
  ["Management approval", "5 working days", "Management at day 4"],
  ["Approval to SARP submission", "3 working days", "SARP Liaison at day 2"],
], [0.4, 0.25, 0.35]);

// =====================================================================
// 5 FUNCTIONAL REQUIREMENTS
// =====================================================================
H1("5  Functional requirements");
P("Requirements are grouped by module. Priorities: **Must** (go-live), **Should**, **Could** (see Section 1.4).");
H2("5.1  Access and user management (M1)");
REQ([
  ["FR-UM-001", "Users log in with username (email), password and a second factor. Privileged roles (Management, SARP Liaison, SARP PMU Officer, Government Official, Admin, DPO) must use WebAuthn/FIDO2 (security key or device passkey); other roles may use WebAuthn or an authenticator app (TOTP). SMS codes are not accepted as a login factor.", M],
  ["FR-UM-002", "Admin creates, edits, deactivates and reactivates users; users are never deleted (to keep the audit trail).", M],
  ["FR-UM-003", "A user can hold several roles; the active roles are shown in the header.", M],
  ["FR-UM-004", "Each user has a district scope (Field Officers, Government Officials) and an agency (Government Officials).", M],
  ["FR-UM-005", "Self-service password reset by email link valid for 30 minutes; MFA reset only through the recovery process in SEC-IAM-07; both notify the user.", M],
  ["FR-UM-006", "Accounts lock after 5 failed attempts for 15 minutes; Admin can unlock.", M],
  ["FR-UM-007", "Sessions end after 15 minutes of inactivity and 8 hours absolute.", M],
  ["FR-UM-008", "Accounts unused for 60 days are disabled automatically; Admin is notified.", M],
  ["FR-UM-009", "Segregation of duties: the system blocks a user from approving (Step 8) any application they prepared, verified or were the only interviewer for.", M],
  ["FR-UM-015", "Quarterly access review report listing users, roles, scope and last login for Management sign-off.", S],
]);
H2("5.2  SOP 01: Registration (M2)");
H3("Requirements");
REQ([
  ["FR-REG-001", "Field Officer creates a registration within their district scope; the record saves as Draft until completed.", M],
  ["FR-REG-002", "On completion the system runs eligibility checks (age band, NIC format and uniqueness, district, mandatory fields, consent) and sets Registered, or Eligibility review with the failed checks listed. The system never closes a registration on its own; only a Senior Team member can confirm Ineligible (FR-REG-011).", M],
  ["FR-REG-003", "The beneficiary ID is generated on first successful completion (Section 6.1) and never changes.", M],
  ["FR-REG-004", "Duplicate warning when name + date of birth or mobile number match an existing record; Field Officer must confirm or cancel.", M],
  ["FR-REG-005", "District quota counter shown on the form; when the quota is reached, completion needs a Management override with reason.", M],
  ["FR-REG-006", "Existing business section appears only when Type of business = Scale-up. All its fields, including brand name, are optional.", M],
  ["FR-REG-007", "Consent: the Field Officer records two separate answers. (1) Data-use consent, mandatory: the applicant has signed the paper data-use consent form (version shown); the form is uploaded; no personal information is saved without it. (2) Indo-Lanka consultancy consent: Yes / No to proposal drafting and related consultancy services by Indo-Lanka Greenhouse and Agri Solutions (Pvt) Ltd. An answer is required, No does not block registration, and No is never treated as consent to services. The registration form carries no wording about AI. Both answers are stored and exported separately.", M],
  ["FR-REG-008", "SMS to the applicant on registration with the beneficiary ID and next steps, in the preferred language.", M],
  ["FR-REG-009", "Forms auto-save every 60 seconds and on field exit, to protect data on weak connections.", S],
  ["FR-REG-010", "Field labels and the consent form are available in Sinhala, Tamil and English.", S],
  ["FR-REG-011", "Eligibility review queue for the Senior Team: shows the failed checks, entered data and NIC image. Actions: return to the Field Officer to correct data, or confirm Ineligible with a reason. The applicant is told by SMS and can ask for a review within 30 days.", M],
  ["FR-REG-012", "Duplicate NIC: the new registration is held in Eligibility review and linked to the existing record. If the earlier record has a wrong NIC, it is corrected through the correction workflow (FR-DP-004) and the new registration continues. Nobody is closed out because of another record's data-entry error.", M],
  ["FR-REG-013", "Location lists: District (the six programme districts), then DS division filtered by district, then GN division filtered by DS. DS and GN lists come from the DS/GN audit list (master data loaded by Admin with an effective date; the list received on 17 November 2026 holds 61 DS divisions and 1,604 GN divisions, after 39 repeated rows were removed). GN is shown as number + name where the list gives a number, otherwise by name; the user can type or correct the GN number for a listed GN (letters, numbers, / and -), and it is stored with the record. Each list ends with Other (type): the user types the DS or GN name (GN number optional), and the record is marked for checking against the audit list. GN division is mandatory. A GN removed from the list stays on existing records but cannot be chosen for new ones.", M],
  ["FR-REG-014", "Age is calculated from the date of birth at the registration date and shown beside it, read-only. Gender is chosen manually; it is not filled from the NIC.", M],
  ["FR-REG-015", "Business registration: Yes / No; if Yes, registration number and registering authority are shown (optional; a warning if the number is missing).", M],
  ["FR-REG-016", "Proposed financial plan (optional): total investment, own contribution, bank loan and SARP contribution in LKR. The form shows the sum of the three sources against the total and warns when they differ or when the SARP contribution exceeds the maximum grant. The figures are carried into SOP 03 as a starting point for Sections 8–9; they are not the approved financial model.", M],
  ["FR-REG-017", "Existing resources (item, quantity, unit, condition/status, remarks) and required resources (item, quantity, unit, estimated cost in LKR, priority, remarks): add-row tables with unlimited rows and row delete, each with a free-text description box (up to 1,500 characters) for resources the applicant describes in their own words; tables and descriptions are optional at registration; editable until the record is locked; shown in the interview pack and available to the freelancer in SOP 03.", M],
  ["FR-REG-018", "Import of pre-registration capture data (the offline capture form used before go-live): Admin imports the capture backup file. The import (a) maps every capture field to the Section 1 fields in the table below, including both resource tables, so nothing is re-entered; (b) keeps the temporary capture reference (for example L1-014) as a searchable field linked to the new beneficiary ID; (c) runs the same eligibility, NIC and duplicate checks as FR-REG-002 and FR-REG-004; (d) creates Draft records for any with a GN not on the approved list or other open points, for the Field Officer to complete; (e) produces an import log of created, held and rejected rows. Imported records keep the original capture date, capturer and consent answers. Password-protected backups are opened only inside the system and the files are deleted after a successful import.", M],
]);
H3("Field specification: Section 1");
TBL(["Field", "Type", "Mandatory", "Validation and notes"], [
  ["Beneficiary ID", "Auto", "System", "SARP-<district code>-<4-digit number>"],
  ["Capture reference", "Text", "Imported only", "Temporary reference from pre-registration capture (FR-REG-018), kept for tracing"],
  ["District", "List", "Yes", "Anuradhapura, Vavuniya, Mannar, Puttalam, Kurunegala, Matale; limited to user scope"],
  ["DS division", "Dependent list + Other (type)", "Yes", "DS divisions on the audit list for the district; Other is typed and flagged for checking"],
  ["GN division (number + name)", "Dependent list + Other (type)", "Yes (name)", "GN divisions on the audit list for the DS (FR-REG-013); GN number typed manually when the list has none (optional); Other: name required, number optional; flagged for checking"],
  ["Agrarian Service Centre", "List", "No", "From master data"],
  ["Full name (as on NIC)", "Text (150)", "Yes", ""],
  ["NIC number", "Text", "Yes", "Old format (9 digits + V/X) or new (12 digits); unique across all records including closed ones"],
  ["Date of birth", "Date", "Yes", "May be filled from the NIC; checked against the birth date encoded in the NIC (NIC day numbers count February as 29 days); mismatch blocks save"],
  ["Age", "Calculated, read-only", "System", "Shown beside date of birth; at registration date; outside the configured youth band goes to Eligibility review"],
  ["Gender", "List", "Yes", "Female / Male / Other / Prefer not to say; manual selection only"],
  ["Preferred language", "List", "Yes", "Sinhala / Tamil / English; drives SMS and form language"],
  ["Education qualification", "List + Other (type)", "No", "From master list; Other is typed"],
  ["Mobile number", "Phone", "Yes", "Sri Lankan mobile format; verified by SMS code"],
  ["WhatsApp number; email", "Phone; email", "No", "Format checks"],
  ["Permanent address", "Text", "Yes", ""],
  ["Proposed agribusiness", "Text (200)", "Yes", ""],
  ["Business category", "List + Other (type)", "Yes", "Vegetable cultivation, Fruit cultivation, Mushroom production, Protected agriculture, Plant nursery, Organic agriculture, Irrigation technology, Livestock, Aquaculture, Post-harvest management, Food processing, Value addition, Marketing (master data); Other is typed (required when Other is chosen); the export marks whether it came from the list"],
  ["Sub-category", "Text or list", "No", ""],
  ["Type of business", "List", "Yes", "Start-up / Scale-up"],
  ["Business registered; registration number; registering authority", "Yes/No; text; text", "No", "Number and authority shown only if Yes (FR-REG-015)"],
  ["Land / building ownership", "List", "No", "Owned / Leased / Family-owned / Other (specify)"],
  ["Land extent (acres)", "Decimal (2 dp)", "No", "Greater than 0 if entered"],
  ["Building / structure size (sq ft)", "Integer", "No", ""],
  ["Related experience: years; description", "Decimal; text", "No", ""],
  ["Other assets", "Text", "No", ""],
  ["Existing business: name, brand name, address, telephone, sector", "Text", "No", "Shown only for scale-up"],
  ["Existing business: investment, annual turnover (LKR)", "Currency", "No", "Non-negative"],
  ["Existing business: annual net profit (LKR)", "Currency", "No", "May be negative (loss)"],
  ["Existing business: years in operation; profitable (Y/N); products", "Mixed", "No", ""],
  ["Proposed financial plan: total investment, own contribution, bank loan, SARP contribution (LKR)", "Currency × 4", "No", "Non-negative; warnings in FR-REG-016"],
  ["Existing resources", "Table, unlimited rows", "No", "Item, quantity, unit, condition/status, remarks (FR-REG-017)"],
  ["Existing resources: description", "Text (1,500)", "No", "Free-text description in the applicant's own words"],
  ["Required resources", "Table, unlimited rows", "No", "Item, quantity, unit, estimated cost (LKR, row total), priority (High / Medium / Low), remarks"],
  ["Required resources: description", "Text (1,500)", "No", "Free-text description in the applicant's own words"],
  ["Data-use consent", "Yes/No + upload + version + form serial", "Yes", "Must be Yes (signed) before personal information is saved"],
  ["Indo-Lanka consultancy consent", "Yes/No", "Yes (an answer)", "No permitted and does not block registration; never treated as consent to services (FR-REG-007)"],
  ["Original NIC seen; NIC copy collected", "Checkboxes", "No", "Warning if original NIC not seen"],
], [0.32, 0.15, 0.12, 0.41], { size: 16 });

H2("5.3  SOP 02: Interview and shortlisting (M3)");
H3("Requirements");
REQ([
  ["FR-INT-001", "Interview pack: one-click PDF of the SOP 01 profile, land details, existing business data and document checklist status, marked Confidential.", M],
  ["FR-INT-002", "Scheduling: date, time, venue type (DS office / field / online), panel members (minimum two, chosen from Senior Team users), panel chair.", M],
  ["FR-INT-003", "Each panel member declares no conflict of interest with the applicant before scoring; a declared conflict removes them from the panel.", M],
  ["FR-INT-004", "SMS to the applicant on scheduling and rescheduling, and a reminder one day before.", M],
  ["FR-INT-005", "Reschedule with reason; after the configured maximum (default 2) or a no-show, the record goes On hold.", M],
  ["FR-INT-006", "Interview form sections A–F (table below) on a tablet-friendly screen; sections can be saved part-way.", M],
  ["FR-INT-007", "Site verification (section D): GPS coordinates captured from the device, at least two site photos, water source check; can be waived only with a reason.", M],
  ["FR-INT-008", "Existing resources and required resources tables and their free-text descriptions, pre-filled from registration (FR-REG-017) and updated at interview; each row keeps its source (registration or interview).", M],
  ["FR-INT-009", "Scorecard: each panel member scores each criterion 1–5 with an optional comment; the system shows the weighted panel average and the suggested band (Section 6.4).", M],
  ["FR-INT-010", "Decision: Shortlisted / On hold / Not shortlisted / Withdrawn; a decision different from the suggested band needs a written reason.", M],
  ["FR-INT-011", "Own contribution amount and source recorded here carry into the SOP 03 funding check.", M],
  ["FR-INT-012", "SMS to the applicant on the decision (no score shown).", M],
]);
H3("Interview form: sections A–F");
TBL(["Section", "Fields captured", "Captured by"], [
  ["A  Interview record", "Date, time, venue; panel members; attendance (attended / rescheduled / no-show); documents seen at interview (NIC, land deed); duration; interviewer notes", "Panel"],
  ["B  Applicant profile and commitment", "Motivation; time available (full-time / part-time); family and labour support (number of workers); training received and needed; other household income sources", "Panel"],
  ["C  Business idea and market", "Products and planned production volume; target buyers and market access (named buyers, distance to market); expected selling prices; competition; seasonality; expected outcome and growth plan", "Panel"],
  ["D  Land, water and site", "Site visit done (Y/N), date, visited by; GPS location; site photos; land ownership confirmed against SOP 01; water source, reliability and quality; road and electricity access", "Field Officer or panel"],
  ["E  Financial capacity", "Own contribution: amount and source (cash, land, labour); willingness to take a loan and amount; existing loans or repayments (Y/N); bank account available (Y/N); estimated total investment", "Panel"],
  ["F  Risks and support needs", "Key risks (weather, pests, disease, market); mitigation agreed; technical support Indo-Lanka should give; missing information or documents; follow-up actions and owner", "Panel"],
], [0.22, 0.6, 0.18], { size: 17 });
H3("Assessment scorecard");
TBL(["Criterion", "What the panel looks for", "Weight"], [
  ["Commitment and motivation", "Clear reason, time available, family support", "20"],
  ["Experience and skills", "Years in the sector; training", "15"],
  ["Business viability and market", "Named buyers; realistic prices and volumes", "20"],
  ["Land, water and site", "Confirmed at the site visit", "15"],
  ["Own contribution and finances", "Amount, source, loan readiness", "15"],
  ["Technical feasibility", "Suits local climate; inputs available", "10"],
  ["Social impact", "Jobs created; youth and women involved", "5"],
  ["Total", "", "100"],
], [0.32, 0.53, 0.15], { totalLast: true, align: [null, null, AlignmentType.CENTER] });
P("Weights, criteria and decision bands are master data that the Admin can change before interviews start; a change after the first interview is scored needs Management approval and applies only to interviews scored afterwards.");

H2("5.4  SOP 03: Assignment and proposal preparation (M4)");
H3("Assignment (Step 4)");
REQ([
  ["FR-PRO-001", "Senior Team assigns a shortlisted applicant to one active freelancer and sets a target date (default 14 days).", M],
  ["FR-PRO-002", "Assignment screen shows each freelancer's open assignments, overdue items and average turnaround; assignment above the configured cap (default 10 open) needs a reason.", M],
  ["FR-PRO-003", "Reassignment keeps all work and history; the previous freelancer loses access immediately.", M],
]);
H3("Sections 2–7: AI-assisted drafting");
REQ([
  ["FR-PRO-010", "Freelancer can request an AI draft of each section (2 Executive summary, 3 Background and rationale, 4 Objectives, 5 Business description, 6 Market analysis, 7 Others) in the official SARP structure.", M],
  ["FR-PRO-011", "Only the approved AI payload (Section 10.7) is sent: allow-listed structured business fields and a short business brief written for AI. Interview notes, names, NIC, contact details, address, district, DS and GN division, village, bank details and photos are never sent.", M],
  ["FR-PRO-012", "If the applicant answered No to Indo-Lanka consultancy consent, the application is not assigned to an Indo-Lanka freelancer for drafting; it is routed as the SARP PMU decides (decision 15). AI drafting is available only when the controller has enabled it and recorded its lawful basis (Section 8.3); otherwise AI buttons are hidden and the freelancer writes the sections manually.", M],
  ["FR-PRO-013", "The AI draft and the freelancer's final text are both stored; a section is complete only when the freelancer ticks 'I have reviewed and confirm this section'.", M],
  ["FR-PRO-014", "Similarity check flags sections more than 80% similar to another applicant's text (threshold configurable).", S],
  ["FR-PRO-015", "Prompt templates are versioned master data controlled by Admin; the version used is stored with each draft.", M],
  ["FR-PRO-016", "If the AI service is unavailable, the freelancer is told and can continue manually; no data is lost.", M],
  ["FR-PRO-017", "Before each request the freelancer sees a payload preview with removed items highlighted and must confirm it contains no personal details.", M],
  ["FR-PRO-018", "The AI integration is switched off by default. It is enabled only after the payload test in Section 10.7 passes and the DPO signs off, and is switched off again if the filter, allow-list or templates change until the test is repeated.", M],
]);
H3("Sections 8–9: financial plan and analysis");
REQ([
  ["FR-FIN-001", "Investment plan lines: item, category (equipment, structure, livestock, planting material, working capital, other), quantity, unit cost, total, funding source (SARP grant / own / loan), useful life (years), linked quotation document.", M],
  ["FR-FIN-002", "Operating cost lines by year (raw materials, labour, utilities, transport, maintenance, other) for at least 3 years (configurable up to 5).", M],
  ["FR-FIN-003", "Revenue lines by product: unit, quantity and price per year.", M],
  ["FR-FIN-004", "Loan details: lender, amount, annual interest rate, term in months, grace period, repayment frequency; the system generates the repayment schedule.", M],
  ["FR-FIN-005", "System calculates depreciation, profit and loss, cash flow and the Section 9 indicators using the formulas in Section 6.6; users cannot overwrite calculated values.", M],
  ["FR-FIN-006", "Funding check (Section 6.5) runs on every save; submission is blocked until it passes.", M],
  ["FR-FIN-007", "Warnings (not blocks) for: payback beyond the projection period, negative net profit in Year 3, DSCR below 1.2 in any year.", M],
  ["FR-FIN-008", "Financial tables export to the Excel workbook included in the final package.", M],
]);
H3("Section 10: government recommendations");
REQ([
  ["FR-GOV-001", "Freelancer records each recommendation: agency, purpose, officer name, designation, date, status (Pending / Received / Not required) and the letter upload.", M],
  ["FR-GOV-002", "Required recommendations depend on the business category (master data). 'Received' needs an attached letter.", M],
  ["FR-GOV-003", "Release to management approval is blocked until all required recommendations are Received.", M],
]);

H2("5.5  SOP 04: Documents and verification (M5)");
REQ([
  ["FR-DOC-001", "One document folder per beneficiary ID, shared by all SOPs, organised by checklist category (Appendix A).", M],
  ["FR-DOC-002", "Accepted formats PDF, JPG, PNG; maximum 10 MB per file (configurable); images over 3 MB are compressed automatically; file content type is checked, not only the extension.", M],
  ["FR-DOC-003", "Every upload is virus-scanned before it is stored; infected files are rejected and logged.", M],
  ["FR-DOC-004", "Re-uploading creates a new version; earlier versions remain viewable by Reviewer and Management.", M],
  ["FR-DOC-005", "Document statuses: Missing, Uploaded, Under review, Verified, Returned (with comment). Verified documents can only be replaced after the Reviewer reopens them.", M],
  ["FR-DOC-006", "Checklist summary per applicant: required, received, verified, under review, returned, missing.", M],
  ["FR-DOC-007", "Uploads are allowed from SOP 01 until the record is locked at Approved for submission, subject to the gate rules in Section 6.7.", M],
  ["FR-DOC-008", "Reviewer checklist for the proposal: completeness of Sections 2–10, consistency with interview data, financial warnings reviewed, Section 10 letters valid.", M],
  ["FR-DOC-009", "Return for correction requires a comment linked to a section or document; the freelancer sees all open comments in one list.", M],
  ["FR-DOC-010", "Weekly missing-document reminder to the responsible user.", S],
  ["FR-DOC-011", "Documents are downloaded through short-lived signed links checked against the user's scope; direct storage URLs are never exposed.", M],
  ["FR-DOC-012", "Each checklist item in master data has an upload deadline gate (G1–G4), the roles allowed to upload it and the role that verifies it (Section 6.7, Appendix A). The workflow enforces these gates.", M],
]);

H2("5.6  SOP 05: Approval, submission and SARP tracking (M6)");
REQ([
  ["FR-APP-001", "Management sees a single approval view: Sections 1–10, scorecard summary, financial indicators and warnings, document checklist, comment history.", M],
  ["FR-APP-002", "Pre-approval checks shown as pass/fail: documents verified, funding balanced, grant within limit, Section 10 complete, bank details verified, segregation of duties.", M],
  ["FR-APP-003", "Approve or Return (comment mandatory). Approval is confirmed with a fresh WebAuthn/FIDO2 check (step-up authentication).", M],
  ["FR-APP-004", "On approval the system generates the final application (Section 10.6): PDF (Sections 1–10), Word (editable), Excel (financial workbook) and a document pack, and locks the record.", M],
  ["FR-APP-005", "Generated files carry the beneficiary ID, version number, generation date and a SHA-256 checksum stored in the system.", M],
  ["FR-APP-006", "SARP Liaison records submission date, method and SARP reference; status becomes Submitted to SARP.", M],
  ["FR-APP-007", "Review stages before the Committee (line agency review, district / provincial review) are recorded with date, outcome, comment and attachment, by the SARP Liaison or by a Government Official for their own agency's stage only. These entries are comments on the application, not the grant decision.", M],
  ["FR-APP-008", "A SARP clarification creates a correction task for the Senior Team, who either restores access for the original freelancer (if still active) or reassigns the work to another freelancer; access covers that application only. The submitted package stays read-only as version n; work continues on version n+1, which repeats verification (G3, G4) and approval before resubmission. The resubmission records which version answers the clarification.", M],
  ["FR-APP-009", "Final decision (SARP approved / SARP rejected) notifies the applicant by SMS and the freelancer and Management by email.", M],
  ["FR-APP-010", "Bank details for disbursement (bank, branch, account holder, account number) are captured in SOP 03 by the freelancer or Field Officer with the bank confirmation uploaded by gate G3, verified by the Reviewer at G4, masked on screen except for the last four digits, and visible in full only to Management.", M],
  ["FR-APP-011", "Only the SARP PMU Officer, or the SARP Liaison with Management confirmation, can record a SARP Project Committee decision (approved, rejected or clarification). Required evidence: committee meeting date, minute or reference number, signed minutes or decision letter (upload), approved grant amount, and reason for rejection. The decision cannot be saved without this evidence.", M],
]);

H2("5.7  Dashboards and reports (M7)");
TBL(["Report / view", "Content", "Audience"], [
  ["Pipeline", "Count by status and SOP, by district; drill-down to list", "MG, ST, RV, SL"],
  ["District quota", "Registered, shortlisted, submitted, approved against quota per district", "MG, ST"],
  ["Freelancer workload", "Open assignments, overdue, average turnaround, returns per freelancer", "MG, ST"],
  ["Turnaround", "Average and maximum days per stage against targets", "MG"],
  ["Interview scores", "Score distribution, overrides, decisions by district", "MG, ST"],
  ["Missing documents", "Applicants with missing or returned items, by responsible user", "All internal (in scope)"],
  ["Approvals and SARP decisions", "Approved, submitted, under review, approved and rejected by SARP; days in SARP review", "MG, SL, PMU, GO (scope)"],
  ["Grant commitment", "Total grant, own contribution and loan in approved and submitted proposals against programme totals", "MG"],
  ["Inclusion", "Gender, age group and district of applicants at each stage (counts only)", "MG"],
  ["Audit and access", "Logins, failed logins, exports, break-glass events, role changes", "MG, AD"],
  ["Data protection register", "Consents, withdrawals, data subject requests and deadlines, retention runs", "DPO"],
], [0.22, 0.55, 0.23]);
REQ([
  ["FR-RPT-001", "All reports filter by district, date range, status and business category, and export to Excel and PDF.", M],
  ["FR-RPT-002", "Exports that contain personal data need Management or DPO approval, are watermarked with the user and date, and are logged.", M],
  ["FR-RPT-003", "Dashboard figures refresh at least every 15 minutes.", S],
]);

H2("5.8  Notifications (M8)");
TBL(["Event", "Recipient", "Channel", "Content"], [
  ["Registration completed", "Applicant", "SMS", "Beneficiary ID, next step"],
  ["Ineligibility confirmed after eligibility review", "Applicant", "SMS", "Outcome and how to ask for a review within 30 days"],
  ["Interview scheduled / rescheduled / reminder", "Applicant; panel", "SMS; email + in-app", "Date, time, venue; documents to bring"],
  ["Shortlisting decision", "Applicant", "SMS", "Outcome only, no score"],
  ["Assignment; target date near; overdue", "Freelancer; Senior Team", "Email + in-app", "Applicant ID, target date"],
  ["Returned for correction", "Freelancer", "Email + in-app", "Number of open comments, link"],
  ["Ready for approval; approved; returned", "Management; Freelancer; SARP Liaison", "Email + in-app", "Applicant ID, link"],
  ["Submitted to SARP; review stage; decision", "Applicant; Government Officials (scope); SARP PMU Officer; Management", "SMS; email + in-app", "Outcome and next step"],
  ["Security events (new device login, password or MFA change, account locked)", "User", "Email", "Event, time, what to do if not you"],
], [0.3, 0.24, 0.16, 0.3], { size: 17 });
REQ([
  ["FR-NOT-001", "SMS text uses the applicant's preferred language and contains only first name, beneficiary ID and the event; no NIC, scores, amounts or addresses.", M],
  ["FR-NOT-002", "Emails contain links, not personal data; the user must log in to see details.", M],
  ["FR-NOT-003", "Message templates are editable by Admin in all three languages; every sent message is logged with delivery status.", M],
]);

H2("5.9  Audit trail");
REQ([
  ["FR-AUD-001", "Log every create, update (old and new values), delete, status change, view of an applicant record, file download, export, login, logout, failed login, role change and configuration change, with user, role, date-time (Asia/Colombo), IP address and record ID.", M],
  ["FR-AUD-002", "Audit records cannot be edited or deleted through the application; they are written to an append-only store and copied to central logging.", M],
  ["FR-AUD-003", "Management and Admin can search the audit log by user, record, date and action.", M],
  ["FR-AUD-004", "Audit logs are kept for 7 years (configurable).", M],
]);

H2("5.10  Administration and master data (M9)");
TBL(["Master data / setting", "Notes"], [
  ["Districts, DS divisions, GN divisions, Agrarian Service Centres", "District code (3 letters) used in the beneficiary ID; quota per district"],
  ["Youth age band", "Minimum and maximum age at registration date"],
  ["Business categories and sub-categories", "13 categories confirmed by Indo-Lanka (17 November 2026), listed in Section 5.2; linked to required Section 10 recommendations and document checklist items"],
  ["Document checklist", "Category, mandatory flag, condition (e.g. scale-up only), stage"],
  ["Scorecard", "Criteria, weights, bands; versioned"],
  ["Financial parameters", "Maximum grant (default LKR 900,000), project value, projection years, DSCR warning level"],
  ["Service-level targets and reminder timings", "Section 4.5"],
  ["AI prompt templates", "Per section, versioned, with change log"],
  ["Notification templates", "Sinhala, Tamil, English"],
  ["Retention periods", "Section 8.8"],
  ["Lists", "Education levels, land ownership types, venue types, lenders"],
], [0.4, 0.6]);
REQ([
  ["FR-ADM-001", "All master data changes are logged with before and after values.", M],
  ["FR-ADM-002", "Changes to financial parameters, scorecard and retention periods need Management approval (four-eyes).", M],
]);

H2("5.11  Data protection functions (M10)");
REQ([
  ["FR-DP-001", "Consent register: data-use consent version, date, channel, signed form and form serial; Indo-Lanka consultancy answer; AI permission only if the controller enables AI with consent as its basis; withdrawal recorded with date and effect.", M],
  ["FR-DP-002", "Data subject request register: type (access, correction, erasure, objection, withdrawal of consent, review of a decision), date received, identity check, due date, action, closure.", M],
  ["FR-DP-003", "Access request: DPO generates a PDF of all personal data held on the applicant (Sections 1–10 personal parts, documents list, decisions).", M],
  ["FR-DP-004", "Correction: corrected values go through normal editing with the request ID attached to the audit entry.", M],
  ["FR-DP-005", "Retention job runs monthly, lists records due for anonymisation or deletion, and executes after DPO approval (Section 8.8).", M],
  ["FR-DP-006", "Anonymisation keeps statistical fields (district, category, gender, age group, outcomes, amounts) and removes or irreversibly hashes identifiers.", M],
  ["FR-DP-007", "Breach register: date found, description, data and people affected, risk rating, notifications made, actions.", M],
]);

H2("5.12  Non-functional requirements by module");
P("Performance, availability, usability and other non-functional requirements are in Section 12.");
H2("5.13  SOP 06: Post-approval monitoring (Phase 2 outline)");
P("Phase 2 will extend the same application record after SARP approval. The Phase 1 data model must allow these features to be added without restructuring:");
BL([
  "**Disbursement tracking:** grant tranches, dates and conditions met (recorded, not paid, by the system).",
  "**Implementation visits:** field visit notes, GPS and photos against the Section 8 investment plan.",
  "**Fund utilisation:** actual spend against the investment plan, with receipts.",
  "**Technical guidance log:** advice given by Indo-Lanka after approval.",
  "**Impact indicators:** income, employment and production at agreed intervals for IFAD reporting.",
  "**Offline capture** for field visits with later synchronisation.",
]);

// =====================================================================
// 6 BUSINESS RULES
// =====================================================================
H1("6  Business rules and calculations");
H2("6.1  Beneficiary ID");
BL([
  "Format **SARP-<DDD>-<NNNN>**, where DDD is the 3-letter district code from master data and NNNN a running number per district starting at 0001 (for example SARP-VAV-0001).",
  "Generated in a database transaction on first successful registration so that two users can never receive the same number.",
  "Registrations in Eligibility review or Ineligible do not receive an ID; they are stored with an internal record number until they pass.",
  "IDs are never reused, edited or reassigned, including after withdrawal.",
]);
H2("6.2  Eligibility and duplicate checks");
TBL(["Rule", "Check", "Result if failed"], [
  ["E1 Age", "Age at registration date within the configured youth band", "Eligibility review: Senior Team decides"],
  ["E2 NIC format", "Valid old or new NIC format; birth date and gender in the NIC match the entered values", "Cannot save until corrected"],
  ["E3 NIC unique", "No other record (any status) with the same NIC", "Eligibility review; linked to the existing record for Senior Team comparison (FR-REG-012)"],
  ["E4 District", "District in master list and in the user's scope", "Cannot save"],
  ["E5 Consent", "Data-use consent recorded and form uploaded", "Cannot complete"],
  ["E6 Possible duplicate", "Same name + date of birth, or same mobile number, as another record", "Warning; user must confirm"],
], [0.18, 0.52, 0.3]);
P("An Ineligible decision is made only by a Senior Team member (FR-REG-011) and becomes final when confirmed. It can be reopened by the Senior Team with Management approval if new evidence or a data-entry error is found; every reopening is logged.");
H2("6.3  District quota");
P("Each district has a quota in master data. The counter counts applications that are not closed (excluding Ineligible, Not shortlisted, Withdrawn and SARP rejected). Applications in Eligibility review count towards the quota. Registration beyond the quota needs a Management override with a reason, so that a waiting list can be held.");
H2("6.4  Interview score");
P("For each criterion i with weight w(i) (weights sum to 100) and panel member scores s(i,p) from 1 to 5:");
BL([
  "Panel average score for the criterion: **avg(i) = mean of s(i,p) over panel members**",
  "Weighted score: **W(i) = w(i) × avg(i) ÷ 5**",
  "Total score: **T = sum of W(i)**, rounded to one decimal (0 to 100)",
  "Suggested band (default, configurable, to be confirmed with SARP): **70–100 Shortlisted; 50–69.9 On hold; below 50 Not shortlisted**",
]);
P("Worked example from the process deck (dairy farm, Vavuniya): weights 20/15/20/15/15/10/5 with average scores 4/4/3/4/3/4/3 give 16 + 12 + 12 + 12 + 9 + 8 + 3 = **72**, so Shortlisted.");
H2("6.5  Funding check");
BL([
  "Total project cost **TPC = sum of investment plan line totals**",
  "Funding sources: **G** (SARP grant lines), **O** (own contribution lines), **L** (loan amount)",
  "Rule F1: **G + O + L = TPC** (tolerance LKR 1)",
  "Rule F2: **G ≤ maximum grant** (default LKR 900,000)",
  "Rule F3: **O** must be at least the own contribution recorded at interview, or a reason is required",
  "Rule F4: if the project value is a fixed amount (decision pending), **TPC = LKR 2,000,000**; if a ceiling, **TPC ≤ LKR 2,000,000**",
]);
NOTE("Rule F4 changes test outcomes: a balanced LKR 1.8 million proposal passes if LKR 2,000,000 is a ceiling and fails if it is a fixed value. The SARP PMU must approve this rule, the youth age band and the district quotas by the end of the design phase (week 5), before UAT test cases are finalised (Section 15.1).", C.amber, "Decision needed");
H2("6.6  Financial statements and indicators");
TBL(["Item", "Formula (per year y, for y = 1 … n, n ≥ 3)"], [
  ["Revenue R(y)", "Sum over products of quantity(y) × price(y)"],
  ["Operating cost OC(y)", "Sum of operating cost lines for year y (capital items are excluded)"],
  ["Depreciation D(y)", "Straight line: sum of (line total ÷ useful life) for depreciable items still within their useful life"],
  ["Loan instalment", "Equal instalments after any grace period: PMT = P × r ÷ (1 − (1 + r)^−N), where r = annual rate ÷ periods per year and N = number of instalments; each instalment split into interest and principal"],
  ["Interest I(y), principal PR(y)", "Sums of the interest and principal parts of instalments falling in year y"],
  ["Net profit NP(y)", "R(y) − OC(y) − D(y) − I(y)  (income tax not modelled)"],
  ["Operating cash flow OCF(y)", "R(y) − OC(y)"],
  ["Net cash flow after financing NCF(y)", "OCF(y) − I(y) − PR(y)"],
  ["Net profit margin NPM(y)", "NP(y) ÷ R(y), shown as % per year"],
  ["Return on investment ROI", "Average of NP(y) over n years ÷ TPC, shown as one %"],
  ["Payback period", "Years until cumulative OCF reaches TPC, interpolated within the year; one figure. If not reached within n years, shown as 'more than n years' with a warning"],
  ["Debt service coverage DSCR(y)", "(NP(y) + D(y) + I(y)) ÷ (PR(y) + I(y)); per year, only when there is a loan"],
], [0.3, 0.7], { size: 17 });
NOTE("Capital items appear only in the investment plan, never in operating costs; loan principal appears only in cash flow, never as an expense; payback is a single figure. These correct errors in the first version of the process slides.", C.blue, "Rule");
H2("6.7  Document completeness");
P("Every checklist item has an upload deadline gate, the roles allowed to upload it and the role that verifies it (Appendix A). Conditional items (for example business registration for scale-ups) apply only when their condition is met.");
TBL(["Gate", "Workflow point", "Rule"], [
  ["G1", "Registration complete (Step 2, DRF → REG)", "Items due at G1 uploaded"],
  ["G2", "Interview decision (Step 3c, INT → SHL)", "Items due at G1–G2 uploaded"],
  ["G3", "Submit for verification (end of Step 5, PIP → UVR)", "Items due at G1–G3 uploaded"],
  ["G4", "Release to management approval (end of Step 7, UVR → PMA)", "Every applicable item Verified by the Reviewer"],
], [0.1, 0.5, 0.4]);
BL([
  "No mandatory document is due after G4. Bank account confirmation and the signed proposal and declaration are due at G3 and verified at G4, so management approval and submission never wait for an unverified document.",
  "If a document changes after a return for correction (for example a declaration re-signed on the corrected proposal), the new version must be uploaded and verified again before G4.",
  "After G4, a verified item can be replaced only after the Reviewer reopens it, which returns the application to verification. Optional items can still be added; the Reviewer decides whether they are material.",
]);
H2("6.8  Locking and versioning");
BL([
  "The application locks at Approved for submission. Only the Admin can reopen it, with Management approval and a reason; every reopen creates a new version number.",
  "A SARP clarification reopens the record as a new version; the submitted version and its package stay read-only, and the Senior Team decides who makes the corrections (FR-APP-008).",
  "Each generated final package is stored with its version number and checksum; earlier packages are kept.",
]);

// =====================================================================
// 7 DATA MODEL
// =====================================================================
H1("7  Data model");
H2("7.1  Entity overview");
FIG("dg/er.png", 6.3, "Figure 3: Main entities and relationships (crow's foot = many)");
H2("7.2  Entity descriptions");
TBL(["Entity", "Purpose", "Key attributes"], [
  ["USER, ROLE", "System users and their roles", "user ID, name, email, mobile, status, WebAuthn credentials (public keys only), TOTP secret (encrypted; non-privileged roles), roles, district scope, agency, last login"],
  ["DISTRICT", "District master and quota", "code (3 letters), name, quota, DS / GN / ASC child lists"],
  ["BENEFICIARY", "The person (Section 1 personal data)", "beneficiary ID, capture reference (if imported), NIC (encrypted + search hash), name, DOB, gender, language, contact details, address, district, DS and GN division (GN number + name)"],
  ["CONSENT", "Consent records", "version, type (data use / Indo-Lanka consultancy / AI where enabled), given or withdrawn, date, form document and serial"],
  ["APPLICATION", "The workflow record; one per beneficiary", "application ID, beneficiary ID, current status, version, business details, assigned freelancer, dates per stage, lock flag"],
  ["INTERVIEW, INTERVIEW_SCORE, SITE_VISIT", "SOP 02 data", "schedule, panel, sections A–F answers, per-member scores and comments, total, decision, override reason; GPS, photos, water check"],
  ["RESOURCE_ITEM, REQUIREMENT_ITEM", "Existing and required resources: captured at registration (FR-REG-017) and updated at interview", "item, quantity, unit, condition/status, remarks; item, quantity, unit, estimated cost, priority, remarks; source (registration / interview). The two free-text descriptions are stored on APPLICATION"],
  ["REG_FIN_PLAN", "Proposed financial plan at registration", "total investment, own contribution, bank loan, SARP contribution"],
  ["GN_DIVISION", "Approved eligible GN list", "district, DS division, GN number, GN name, effective from / to"],
  ["ASSIGNMENT", "Freelancer assignments and correction tasks (history kept)", "freelancer, assigned by, type (proposal / SARP clarification), application version, dates, target date, end reason"],
  ["PROPOSAL_SECTION", "Sections 2–7 and 10 text", "section number, AI draft, final text, prompt template version, confirmed by, confirmed at"],
  ["FINANCIAL_MODEL, FIN_LINE", "Sections 8–9", "projection years, loan terms, calculated results; lines for investment, cost, revenue by year"],
  ["GOV_RECOMMENDATION", "Section 10 entries", "agency, purpose, officer, designation, status, date, letter"],
  ["DOCUMENT, DOCUMENT_VERSION", "Files", "checklist category, status, reviewer comment; version number, storage key, size, type, SHA-256, scan result, uploaded by and at"],
  ["APPROVAL", "Approval decisions", "approver, decision, comment, checks result, MFA confirmation"],
  ["SARP_REVIEW", "External review stages and Committee decision", "stage, date, outcome, comment, recorded by, confirmed by; for Committee decisions: meeting date, minute reference, decision letter, approved grant amount"],
  ["GENERATED_OUTPUT", "Final packages", "version, file type, storage key, checksum, generated at"],
  ["STATUS_HISTORY", "Workflow history", "from, to, user, date-time, comment"],
  ["AUDIT_LOG", "Security and data audit", "user, action, object, old and new values, IP, date-time"],
], [0.25, 0.25, 0.5], { size: 16 });
H2("7.3  Data classification");
TBL(["Class", "Examples", "Required protection"], [
  ["Restricted personal", "NIC number, date of birth, bank account, signed consent and NIC images, GPS of home or land", "Field-level encryption (NIC, bank account); masked display; access by role and scope; every view logged; never sent to AI or in SMS or email"],
  ["Personal", "Name, contact details, address, gender, education, interview answers, photos", "Encryption at rest; role and scope access; not sent to AI"],
  ["Confidential business", "Business plans, financial model, scores, decisions, comments", "Encryption at rest; role and scope access; only the allow-listed AI payload (Section 10.7) is sent to AI"],
  ["Internal", "Master data, templates, configuration", "Role-based access"],
  ["Statistical", "Anonymised counts and amounts", "May be shared in reports"],
], [0.18, 0.4, 0.42], { size: 17 });

// =====================================================================
// 8 PDPA
// =====================================================================
H1("8  Data protection (PDPA) compliance design");
H2("8.1  Legal position and timeline");
P("The Personal Data Protection Act, No. 9 of 2022 has been amended by the Personal Data Protection (Amendment) Act, No. 22 of 2025, certified on 30 October 2025. Under Extraordinary Gazette No. 2498/16 of 22 July 2026, sections 2 and 3, Part I (processing of personal data) and Part III (controllers and processors: data protection officers, breach notification, impact assessments and cross-border transfers) come into operation on **1 January 2027**. Part II (data subject rights) and Part VII (penalties) await a further Gazette order. The Data Protection Authority's Circular No. 01/2026 directs public-sector institutions to prepare.");
P("The system is expected to go live around or after 1 January 2027, so it must comply with Parts I and III from day one. It will also support data subject rights now (Section 8.5), so that no rework is needed when Part II commences.");
NOTE("This section sets system requirements. It is not legal advice; the controller's legal adviser and DPO should confirm the lawful basis, roles and retention periods before go-live.", C.amber, "Important");
H2("8.2  Roles under the PDPA (to confirm)");
TBL(["Party", "Proposed PDPA role", "Obligations reflected in this design"], [
  ["SARP Project Management Unit / Ministry of Agriculture", "Controller (public authority)", "Decides purposes; appoints DPO; approves DPIA, retention and transfers"],
  ["Indo-Lanka Greenhouse and Agri Solutions", "Processor", "Processes only on documented instructions; written processing agreement; security; breach notice to controller without delay"],
  ["Hosting provider", "Sub-processor", "Written agreement; location in Sri Lanka preferred; security certifications"],
  ["AI service provider", "Sub-processor", "Receives a minimised, pseudonymised payload that is still treated as personal data; section 26 transfer instrument; zero data retention; no training (Section 8.7)"],
  ["SMS and email providers", "Sub-processors", "Minimal data (Section 5.8); written agreement"],
  ["Freelancers", "Persons acting under the processor", "Individual confidentiality undertakings; access only to assigned records"],
], [0.3, 0.22, 0.48], { size: 17 });
H2("8.3  Lawful basis and consent");
BL([
  "Proposed basis: processing is necessary for a public function of the controller (delivery of the SARP grant programme), supported by the applicant's written informed consent for collection. The controller's legal adviser confirms the final basis.",
  "Consent form in Sinhala, Tamil and English, explaining: who the controller is, purposes, what data is collected, who it is shared with (SARP, line agencies, Indo-Lanka as consultant where the applicant agrees), retention, rights and contact for the DPO.",
  "From v1.2 the registration form asks no question about AI. The separate Indo-Lanka consultancy consent covers proposal drafting and consultancy services only; No does not affect eligibility. AI-assisted drafting stays switched off until the controller confirms its lawful basis, the applicant notice and the section 26 instrument (decision 10). If consent is chosen as that basis, it is asked separately at the proposal stage and refusal does not affect eligibility.",
  "Consent withdrawal is recorded; processing that relies on it stops, while records needed for the programme's legal and audit duties are retained as the controller decides.",
]);
H2("8.4  Privacy by design: principle to control");
TBL(["PDPA principle", "System control"], [
  ["Lawful, fair and transparent processing", "Consent capture and register; multilingual privacy notice shown at registration and in the interview pack"],
  ["Purpose limitation", "Data used only for YED selection, proposal and programme reporting; exports approved and logged; no marketing use"],
  ["Data minimisation", "Only fields in Section 5 are collected; free-text guidance warns against entering health, religion or other unnecessary data; SMS and email minimal"],
  ["Accuracy", "NIC and date-of-birth cross-check, mobile verification, correction workflow (FR-DP-004)"],
  ["Storage limitation", "Retention schedule and monthly retention job (Section 8.8)"],
  ["Integrity and confidentiality", "Encryption, MFA, role and scope access, audit logging, backups (Section 9)"],
  ["Accountability", "DPIA, records of processing, Data Protection Management Programme support, audit reports, breach register"],
], [0.32, 0.68]);
H2("8.5  Data subject rights");
P("The DPO handles requests through the register in FR-DP-002. The system tracks a default response deadline of one month (extendable with reasons), in line with the amended Act's timescale; the deadline is configurable.");
TBL(["Right", "How the system supports it"], [
  ["Access", "One-click personal data report (FR-DP-003)"],
  ["Rectification", "Correction through normal editing with request reference"],
  ["Erasure", "Anonymisation or deletion after DPO approval, unless retention is legally required; reason recorded"],
  ["Withdraw consent / object", "Consent register; AI processing switched off; downstream effects recorded"],
  ["Review of decisions", "Every shortlisting and approval decision is made and recorded by named people with reasons, so it can be explained and reviewed"],
], [0.28, 0.72]);
H2("8.6  Automated decision-making");
P("No decision about an applicant is made solely by the system. A failed eligibility check only places a registration in Eligibility review, where a Senior Team member decides (FR-REG-011). The scorecard suggests a band, but the panel records the decision and must give reasons for any difference (FR-INT-010). AI only drafts text that a freelancer must review and confirm (FR-PRO-013). Management approval is a human decision confirmed with MFA. This keeps the process outside fully automated decision-making and makes every decision explainable.");
H2("8.7  Cross-border transfers and the AI service");
P("The amended section 26 allows a controller or processor to transfer personal data abroad only when it meets the Act's processing obligations and uses an instrument specified by Data Protection Authority directive, subject to listed exceptions. A public authority must not transfer categories of personal data that the Minister prescribes. The design therefore:");
BL([
  "**Hosts all personal data in Sri Lanka** (recommended): a Sri Lanka-based data centre or government cloud. If an overseas cloud region is chosen, the controller must first confirm no prescribed category is involved and put a DPA-recognised instrument in place.",
  "**Minimises and pseudonymises what goes to the AI service, and still treats it as personal data.** Removing names and NIC numbers alone cannot prove that an applicant is unidentifiable, especially in small rural communities. The payload is limited to the allow-list in Section 10.7: location at province level only, amounts and land size banded, and no interview notes. Because some risk of re-identification remains, the AI request is handled as a transfer of personal data: it relies on the applicant's separate AI consent, needs a section 26 instrument accepted by the controller, and is covered by the DPIA.",
  "**One retention rule:** the AI provider must contractually commit to zero data retention (inputs and outputs not stored after the request is processed) and no use of submitted data for model training. A provider that cannot commit to both is not used.",
  "**Tested before use:** the integration stays switched off until the payload test in Section 10.7 passes with realistic Sinhala, Tamil and English text and the DPO signs off (FR-PRO-018).",
  "Logs every AI request (application ID, section, template version, time, character count) without storing the payload outside the system.",
]);
H2("8.8  Retention and disposal schedule (defaults, to confirm with the controller)");
TBL(["Record", "Default retention", "Action at end"], [
  ["Draft registrations never completed", "30 days after last change", "Delete"],
  ["Ineligible, Not shortlisted, Withdrawn applications", "2 years after closure", "Anonymise personal data; keep statistics"],
  ["SARP rejected applications", "2 years after decision", "Anonymise"],
  ["SARP approved beneficiaries", "Until programme closure + 7 years (audit)", "Anonymise or archive as the controller directs"],
  ["Supporting documents and photos", "Same as the application", "Delete files (all versions)"],
  ["Audit logs", "7 years", "Delete"],
  ["Backups", "Up to 12 months (Section 11.5)", "Expire automatically; deleted data disappears as backups expire"],
  ["Interview packs and exports downloaded by users", "Not kept in the system", "Users must delete local copies after use (training and policy)"],
], [0.4, 0.3, 0.3]);
H2("8.9  Personal data breach management");
NL([
  "Detect: security monitoring alerts (Section 9.7) and staff reporting channel.",
  "Contain within 4 hours of detection: disable accounts, block access, preserve evidence.",
  "Processor notifies the controller without undue delay, and in any case within 24 hours of detection.",
  "Controller assesses risk and notifies the Data Protection Authority and affected applicants as required under Part III and DPA rules; the system's breach register records each step.",
  "Report to Sri Lanka CERT where the incident is a cyber security incident.",
  "Post-incident review and corrective actions within 30 days.",
], "num2");
H2("8.10  DPIA, DPO and records");
BL([
  "A data protection impact assessment is completed before go-live, because the system processes personal data of 1,600 people, uses AI and affects access to grants. It is updated before Phase 2.",
  "The controller designates a DPO; Indo-Lanka designates a privacy contact for the processor side. Both are named in the privacy notice.",
  "Records of processing activities are maintained; the system's data inventory (Section 7) is the technical input.",
]);

// =====================================================================
// 9 CYBER SECURITY
// =====================================================================
H1("9  Cyber security requirements");
H2("9.1  Security baseline");
P("The system must comply with the Sri Lanka CERT Web Application Security Guidelines for Government Organizations (2022), which require a security assessment through Sri Lanka CERT before production release and at least annually, and with the Minimum Information Security Standards and the Information and Cyber Security Policy for Government Organizations. Application controls are verified against **OWASP ASVS 4.0.3 Level 2**.");
P("The CERT website guidelines expect government websites to use the gov.lk domain. The domain for this system is listed as an open decision (Section 15).");
H2("9.2  Identity and access");
REQ([
  ["SEC-IAM-01", "MFA for all users. Phishing-resistant MFA (WebAuthn/FIDO2 with user verification, using a security key or device passkey) is required for login and for approval and decision steps for Management, SARP Liaison, SARP PMU Officer, Government Officials, Admin and DPO. Authenticator-app (TOTP) codes are allowed only for other roles, because typed one-time codes can be phished. SMS codes are not used as a login factor.", M],
  ["SEC-IAM-02", "Passwords at least 12 characters, checked against a breached-password list, hashed with Argon2id; no forced periodic change unless compromise is suspected.", M],
  ["SEC-IAM-03", "Role-based and record-level (scope) authorisation enforced on the server for every request (FR-UM-014).", M],
  ["SEC-IAM-04", "Least privilege for service accounts; separate database accounts for application, migration and reporting.", M],
  ["SEC-IAM-05", "Administrative access to servers only through VPN + bastion host with MFA; no direct SSH or database access from the internet.", M],
  ["SEC-IAM-06", "Leavers' accounts disabled the same day; quarterly access reviews.", M],
  ["SEC-IAM-07", "Recovery without weakening MFA: each privileged user registers two FIDO2 authenticators (primary and backup). If both are lost, identity is verified in person or by video call by the Admin and approved by Management; a one-time enrolment link valid for 24 hours then allows only the registration of a new FIDO2 authenticator. All sessions are revoked and the event is alerted. There is no fallback to TOTP or SMS for privileged roles.", M],
  ["SEC-IAM-08", "Step-up WebAuthn re-authentication for management approval, recording SARP decisions, personal data exports and role changes.", M],
]);
H2("9.3  Application security");
REQ([
  ["SEC-APP-01", "Protection against OWASP Top 10: parameterised queries/ORM, output encoding, CSRF tokens, secure deserialisation, server-side input validation for every field.", M],
  ["SEC-APP-02", "Security headers: Content-Security-Policy, HSTS (1 year), X-Content-Type-Options, frame-ancestors none, Referrer-Policy, Permissions-Policy.", M],
  ["SEC-APP-03", "Cookies Secure, HttpOnly, SameSite=Lax or Strict; session IDs rotated at login and privilege change.", M],
  ["SEC-APP-04", "Rate limiting on login, OTP, password reset, AI requests and file uploads.", M],
  ["SEC-APP-05", "No sensitive data in URLs, logs or error messages; generic error pages.", M],
  ["SEC-APP-06", "Limit third-party components; maintain a software bill of materials; no unmaintained libraries.", M],
  ["SEC-APP-07", "API: authenticated and scoped like the UI; no unauthenticated endpoints except login, password reset and health check.", M],
]);
H2("9.4  Data security");
REQ([
  ["SEC-DAT-01", "TLS 1.2 or higher (TLS 1.3 preferred) for all traffic, including between internal services; HTTP redirected to HTTPS.", M],
  ["SEC-DAT-02", "Encryption at rest (AES-256) for database volumes, document storage and backups.", M],
  ["SEC-DAT-03", "Field-level encryption for NIC and bank account numbers; a keyed hash of NIC for uniqueness search.", M],
  ["SEC-DAT-04", "Encryption keys and secrets kept in a secrets manager or vault, not in code or configuration files; key rotation at least yearly.", M],
  ["SEC-DAT-05", "Masking of NIC and bank account on screen except for users who need the full value.", M],
  ["SEC-DAT-06", "Data loss controls: export approval and watermarking (FR-RPT-002); download logging.", M],
]);
H2("9.5  File upload security");
REQ([
  ["SEC-FIL-01", "Allow-list of file types checked by content (magic bytes), size limits, and filename sanitising.", M],
  ["SEC-FIL-02", "Antivirus scan of every upload before storage; quarantine and alert on detection.", M],
  ["SEC-FIL-03", "Files stored outside the web root in object storage with random keys; served only through authorised, short-lived links.", M],
  ["SEC-FIL-04", "Strip metadata (including embedded GPS) from photos before they are shown outside the application, except the site-visit GPS captured on purpose.", S],
]);
H2("9.6  Infrastructure and network");
REQ([
  ["SEC-INF-01", "Three network zones (edge, application, data); the data zone has no inbound or outbound internet access.", M],
  ["SEC-INF-02", "Web application firewall with OWASP Core Rule Set in front of the application; DDoS protection from the hosting provider.", M],
  ["SEC-INF-03", "Hardened Linux servers (CIS benchmark Level 1); only required ports open; automatic security updates for the OS; monthly patching window for the application stack.", M],
  ["SEC-INF-04", "Separate environments (development, UAT, production); production data never copied to development or UAT unless anonymised. Restore tests use the isolated recovery environment (SEC-INF-06), never UAT.", M],
  ["SEC-INF-05", "Host-based intrusion detection and file integrity monitoring on production servers.", S],
  ["SEC-INF-06", "Isolated recovery environment for restore tests: production-equivalent controls (network isolation, encryption, MFA, logging), access limited to named operations staff with DPO approval for each test, and wiped with evidence after the test.", M],
]);
H2("9.7  Logging, monitoring and incident response");
REQ([
  ["SEC-MON-01", "Central log collection from WAF, web, application, database and OS; logs kept 12 months online (audit log 7 years).", M],
  ["SEC-MON-02", "Alerts for: repeated failed logins, logins from new countries, privilege changes, mass downloads or exports, break-glass use, malware detection, WAF blocks above threshold, backup failures.", M],
  ["SEC-MON-03", "Uptime and performance monitoring with alerts to the support team 24/7.", M],
  ["SEC-MON-04", "Written incident response plan aligned to Section 8.9, with contacts for the controller, DPO, hosting provider and Sri Lanka CERT; tested once a year.", M],
]);
H2("9.8  Secure development lifecycle");
REQ([
  ["SEC-SDL-01", "Code in a private repository with branch protection and mandatory peer review.", M],
  ["SEC-SDL-02", "Automated static analysis (SAST), dependency vulnerability scanning and container image scanning in the build pipeline; high and critical findings block release.", M],
  ["SEC-SDL-03", "Threat model for the system before build; updated for each major change.", M],
  ["SEC-SDL-04", "Developers trained in secure coding; freelancers and staff trained in data handling before getting access.", M],
]);
H2("9.9  Security testing and CERT assessment");
REQ([
  ["SEC-TST-01", "Independent VAPT of the application and infrastructure before go-live. Release criterion (applies to VAPT and Sri Lanka CERT findings alike): all critical and high findings fixed and retested; medium and low findings either fixed or formally risk-accepted by the SARP PMU risk owner, with the DPO consulted where personal data is involved, and a remediation date (medium within 30 days of go-live).", M],
  ["SEC-TST-02", "Security assessment through Sri Lanka CERT before production release and at least annually, as required by the CERT guidelines for government web applications.", M],
  ["SEC-TST-03", "Authenticated vulnerability scanning monthly; VAPT after major changes.", M],
]);

// =====================================================================
// 10 TECHNICAL ARCHITECTURE
// =====================================================================
H1("10  Technical architecture");
H2("10.1  Architecture principles");
BL([
  "Single web application with a REST API, used by a responsive browser front end (desktop, laptop and 10-inch tablets).",
  "Personal data stays in Sri Lanka; only the minimised AI payload (Section 10.7) leaves, under the safeguards in Section 8.7.",
  "Stateless application servers, background workers for slow tasks, and separate storage for documents so each can grow independently.",
  "Open, widely supported technologies with long-term support, to keep running costs low and maintenance easy.",
  "Security and privacy controls built in, not added at the end.",
]);
H2("10.2  Logical and deployment architecture");
FIG("dg/arch.png", 6.3, "Figure 4: Logical deployment with network zones");
H2("10.3  Technology stack");
P("The capacity analysis specified a Linux cloud VPS, PostgreSQL or MySQL, and an external AI API. The recommended stack below meets that baseline; equivalent alternatives are acceptable if they meet every requirement in this document.");
TBL(["Layer", "Recommended", "Acceptable alternative"], [
  ["Operating system", "Ubuntu Server 24.04 LTS", "Red Hat Enterprise Linux 9 / Rocky Linux 9"],
  ["Database", "PostgreSQL 16 (row-level security available, strong JSON support)", "MySQL 8.4 LTS"],
  ["Back end", "Python 3.12 with Django 5.2 LTS and Django REST Framework", "PHP 8.3 with Laravel 11"],
  ["Front end", "React 18 with TypeScript, responsive UI component library", "Server-rendered templates with HTMX"],
  ["Background jobs and cache", "Celery with Redis 7", "Laravel queues with Redis"],
  ["Document storage", "S3-compatible object storage in the same data centre (e.g. MinIO) with versioning and encryption", "Encrypted block volume with application-managed versioning"],
  ["Web server and WAF", "Nginx with ModSecurity and OWASP Core Rule Set", "Provider-managed WAF"],
  ["PDF / Word / Excel generation", "WeasyPrint (PDF), docxtpl (Word), openpyxl (Excel)", "Equivalent libraries"],
  ["Antivirus", "ClamAV daemon", "Commercial scanning engine"],
  ["MFA", "WebAuthn/FIDO2 (security keys or passkeys) for privileged roles and step-up, e.g. py_webauthn; TOTP via django-otp for other roles", "Keycloak with a WebAuthn policy"],
  ["Monitoring and logs", "Prometheus and Grafana; Loki or OpenSearch for logs; Wazuh for host security", "Provider-managed monitoring"],
  ["Backup", "pgBackRest (database, with continuous WAL archiving); restic (documents)", "Provider snapshots plus logical dumps"],
  ["Deployment", "Docker containers, Docker Compose; CI/CD pipeline with SAST and dependency scanning", "Kubernetes (not needed at this scale)"],
], [0.22, 0.45, 0.33], { size: 17 });
H2("10.4  Environments");
TBL(["Environment", "Purpose", "Data", "Indicative size"], [
  ["Development", "Developer build and unit testing", "Synthetic only", "2 vCPU, 4 GB RAM"],
  ["UAT / staging", "User acceptance, security testing, training", "Synthetic or anonymised", "2 vCPU, 8 GB RAM, 100 GB"],
  ["Production", "Live system", "Live personal data", "Section 11.4"],
  ["Recovery test (isolated)", "Quarterly restore tests of production backups (SEC-INF-06)", "Restored production data", "Same controls as production; created for each test and wiped afterwards"],
], [0.18, 0.37, 0.22, 0.23]);
H2("10.5  Integrations");
TBL(["Integration", "Direction", "Data exchanged", "Security"], [
  ["External AI API", "Outbound from workers", "Allow-listed payload (Section 10.7) and section prompt; returned draft text", "TLS; API key in vault; zero data retention and no-training terms; request logging; daily budget cap; disabled until the payload test passes"],
  ["SMS gateway (Sri Lankan provider)", "Outbound", "Mobile number, message text (Section 5.8)", "TLS API; delivery receipts; sender ID registered"],
  ["Email (SMTP relay)", "Outbound", "Email address, notification text with link", "TLS; SPF, DKIM, DMARC on sending domain"],
  ["SARP / Ministry systems", "None in Phase 1", "Submission recorded manually", "Future API to be specified if required"],
], [0.2, 0.15, 0.33, 0.32], { size: 17 });
H2("10.6  Final application generation");
BL([
  "Templates for the PDF and Word outputs follow the official SARP section order (Sections 1–10) and are managed by the Admin.",
  "Generation runs as a background job and completes within 60 seconds; the user is notified when files are ready.",
  "The document pack is a single PDF combining required supporting documents in checklist order, with a cover index.",
  "Outputs are watermarked with the beneficiary ID, version and 'Confidential'.",
]);
H2("10.7  AI drafting pipeline");
NL([
  "Freelancer requests a draft for a section; the system checks that AI is enabled with a recorded lawful basis for the applicant, user scope, the daily budget and that the integration is enabled (FR-PRO-018).",
  "The payload is built only from this allow-list: business category and sub-category; start-up or scale-up; **province** (never district, DS or GN division, or village); products and planned volumes; land extent and investment **in bands** (for example 1–2 acres; LKR 1.0–1.5 million); names and quantities of resources and requirements; market type (local market, collector, processor) without buyer names; and an AI brief of up to 800 characters that the freelancer writes without personal details. Interview notes and other free text are never included.",
  "An automated filter checks the payload in Sinhala, Tamil and English for NIC patterns, phone numbers, email addresses, the applicant's own and family names, other personal names from a names list, and place names from the DS and GN master lists. Any match is removed and highlighted.",
  "The freelancer reviews the payload preview and confirms it contains no personal details (FR-PRO-017).",
  "The approved prompt template for the section is applied and the request is sent over TLS; the request is logged without the payload.",
  "The response is checked for length and format, stored as the AI draft and shown to the freelancer, who edits and confirms it.",
  "Names and exact locations are added only by the system's own output templates, never by the AI.",
], "num3");
P("**Payload acceptance test (before enabling and after any change to the filter, allow-list or templates):**");
BL([
  "Test set of at least 150 realistic business briefs and notes: 50 each in Sinhala, Tamil and English, seeded with names, NIC numbers, phone numbers, email addresses, village and GN names and street addresses.",
  "Pass criterion: no seeded direct identifier appears in any generated payload. Any failure is fixed and the full test repeated.",
  "Results reviewed and signed off by the DPO; sign-off is a condition for switching the integration on.",
]);
H2("10.8  API conventions");
BL([
  "REST over HTTPS with JSON; versioned paths (/api/v1/…); OpenAPI specification published to the development team.",
  "Authentication by secure session cookie for the web front end; no long-lived API tokens for users.",
  "Consistent error format; pagination for lists; optimistic locking (version field) to stop two users overwriting each other's changes.",
]);

// =====================================================================
// 11 CAPACITY
// =====================================================================
H1("11  Capacity, sizing and infrastructure for 1,600 beneficiaries");
H2("11.1  Basis");
P("The System Capacity Analysis sized the system for 600 beneficiaries. This section repeats that method for 1,600, using the same storage per page and per photo (registration and interview 0.15 MB per page, proposal 0.2 MB per page, supporting documents 1 MB per scanned page, photos 3 MB each; 1 GB = 1,000 MB). Two quantities change because of the revised interview: the interview record grows from 2 to 4 pages (form A–F plus scorecard), and photos from 4 to 6 per beneficiary (adding two site-visit photos).");
H2("11.2  Document storage calculation");
TBL(["Document type", "Per beneficiary", "Total for 1,600", "Estimated storage", "At 600 (capacity deck)"], [
  ["Registration", "2 A4 pages", "3,200 pages", "0.48 GB", "0.18 GB"],
  ["Senior interview (form A–F + scorecard)", "4 A4 pages", "6,400 pages", "0.96 GB", "0.18 GB"],
  ["Business proposal", "10 A4 pages", "16,000 pages", "3.20 GB", "1.20 GB"],
  ["Supporting documents", "15 A4 pages", "24,000 pages", "24.00 GB", "9.00 GB"],
  ["Photographs", "6 photos", "9,600 photos", "28.80 GB", "7.20 GB"],
  ["Total", "31 pages + 6 photos", "49,600 pages + 9,600 photos", "57.44 GB", "17.76 GB"],
], [0.3, 0.17, 0.2, 0.15, 0.18], { totalLast: true, size: 17 });
H2("11.3  Storage requirement");
TBL(["Item", "At 600 (capacity deck)", "At 1,600", "How derived"], [
  ["Original documents and photographs", "17.76 GB", "57.44 GB", "Section 11.2"],
  ["Including revisions (×2)", "35.52 GB", "114.88 GB", "Each file replaced once on average"],
  ["Including 30% allowance", "46.18 GB", "149.34 GB", "Growth and unplanned documents"],
  ["Recommended document storage", "100 GB", "**250 GB** (expandable)", "Covers 1,600 with headroom and growth to about 2,600 beneficiaries at the same rate"],
  ["Database storage allocation", "20 GB", "20 GB (within server SSD)", "Structured data for 1,600 is expected below 10 GB including indexes and audit log"],
  ["Independent backup storage", "250 GB", "**500 GB** (expandable, off-site)", "Section 11.5"],
  ["Total allocated storage", "450 GB", "**950 GB** (Option B, recommended); 850 GB (Option A)", "Option B: 100 GB application SSD + 100 GB database SSD + 250 GB documents + 500 GB backup. Option A: 100 + 250 + 500. Use 950 GB in the hosting quotation."],
], [0.3, 0.18, 0.2, 0.32], { size: 17 });
H2("11.4  Server specification");
P("The capacity deck's single server (4 vCPU, 8 GB RAM) can serve 30 concurrent users. For a government system holding personal data, separating the database from the internet-facing application is a stronger design, and PDF generation, virus scanning and AI jobs need memory headroom. Option B is recommended.");
TBL(["Component", "Option A: capacity deck baseline", "Option B: recommended"], [
  ["Server type", "1 × Cloud VPS, Linux", "2 × Cloud VPS, Linux, in a Sri Lanka data centre"],
  ["Application server", "4 vCPU, 8 GB RAM, 100 GB SSD (application + database)", "4 vCPU, 8 GB RAM, 100 GB SSD (application, workers, WAF/proxy)"],
  ["Database server", "Shared with application (20 GB allocation)", "4 vCPU, 8 GB RAM, 100 GB SSD, private network only"],
  ["Document storage", "100 GB, separate, expandable", "250 GB object storage, encrypted, versioned, expandable"],
  ["Backup storage", "250 GB, separate, expandable", "500 GB at a separate site, encrypted, immutable retention"],
  ["Database", "PostgreSQL / MySQL", "PostgreSQL 16"],
  ["AI processing", "External AI API", "External AI API, pseudonymised (Section 10.7)"],
  ["Security", "HTTPS, encryption, role-based access", "Section 9 in full: WAF, MFA, zones, monitoring, VAPT, CERT assessment"],
  ["Capacity", "41 users, 30 concurrent, 600 beneficiaries", "100 named users, 30 concurrent (60 peak), 1,600 beneficiaries, growth to 3,000+"],
], [0.2, 0.37, 0.43], { size: 17 });
H2("11.5  Backup and recovery");
TBL(["Backup", "Frequency", "Retention", "Change from capacity deck"], [
  ["Database: continuous WAL archiving", "Continuous", "7 days", "Added: reduces data loss to under 1 hour"],
  ["Database backup", "Every 6 hours", "7 days", "As capacity deck"],
  ["Daily backup", "Every night", "30 days", "As capacity deck"],
  ["Weekly backup", "Every week", "12 weeks", "As capacity deck"],
  ["Monthly backup", "Every month", "12 months", "As capacity deck"],
  ["Document backup", "Continuous versioning, copied off-site every 6 hours", "As agreed (default 90 days of versions)", "Retention defined"],
  ["System snapshot", "Weekly", "4 weeks", "As capacity deck"],
  ["Recovery testing", "Every 3 months", "Test report", "Full restore to the isolated recovery environment (not UAT); SHA-256 of every restored document version compared with its database record"],
], [0.28, 0.24, 0.2, 0.28], { size: 17 });
TBL(["Recovery objective", "Target"], [
  ["RPO, database", "1 hour"],
  ["RPO, documents", "6 hours"],
  ["RTO, full service", "8 hours"],
  ["Backups", "Encrypted, stored in a separate location, with immutable (write-once) retention to resist ransomware"],
], [0.35, 0.65]);
H2("11.6  Growth beyond 1,600");
P("The design scales to 3,000 or more beneficiaries without architectural change. At the same rates, 3,000 beneficiaries need about 280 GB of document storage and about 900 GB of backup storage; the application and database servers can be resized (8 vCPU, 16 GB RAM) if concurrent users rise above 60.");

// =====================================================================
// 12 NFR
// =====================================================================
H1("12  Non-functional requirements");
TBL(["ID", "Area", "Requirement", "Priority"], [
  ["NFR-01", "Performance", "Pages load within 3 seconds and searches return within 2 seconds for 95% of requests at 30 concurrent users", M],
  ["NFR-02", "Performance", "Final application generation completes within 60 seconds; AI drafts within 45 seconds", M],
  ["NFR-03", "Capacity", "1,600 beneficiaries, 100 named users, 30 concurrent and 60 peak users; growth to 3,000 beneficiaries without redesign", M],
  ["NFR-04", "Availability", "99.5% per month during 07:00–20:00 Sri Lanka time; maintenance announced 48 hours ahead and done outside these hours", M],
  ["NFR-05", "Recovery", "RPO 1 hour (database), 6 hours (documents); RTO 8 hours", M],
  ["NFR-06", "Usability", "Usable on 10-inch tablets and laptops; interview and registration forms usable one-handed on tablets; key tasks need no more than 3 clicks from the dashboard", M],
  ["NFR-07", "Language", "Sinhala, Tamil and English for applicant-facing outputs (consent, SMS, interview pack); user interface in English with Sinhala and Tamil labels for field forms", S],
  ["NFR-08", "Accessibility", "WCAG 2.1 AA for the user interface", S],
  ["NFR-09", "Browsers", "Latest two versions of Chrome, Edge, Firefox and Safari", M],
  ["NFR-10", "Connectivity", "Auto-save and retry on weak connections; offline capture in Phase 2", M],
  ["NFR-11", "Localisation", "Time zone Asia/Colombo; date format dd/mm/yyyy; currency LKR with thousand separators", M],
  ["NFR-12", "Maintainability", "Automated tests cover all business rules in Section 6; code and API documented; configuration without code changes for master data", M],
  ["NFR-13", "Portability", "Containerised deployment that can move between Sri Lanka hosting providers or a government cloud", S],
  ["NFR-14", "Support", "Business-hours helpdesk; critical incidents (system down, data breach) responded to within 1 hour, 24/7", M],
], [0.1, 0.15, 0.63, 0.12], { size: 17 });

// =====================================================================
// 13 TESTING
// =====================================================================
H1("13  Testing and acceptance");
TBL(["Test type", "Scope", "Exit criteria"], [
  ["Unit and integration", "All business rules (Section 6), status transitions (Section 4.4), APIs", "All tests pass; business-rule coverage complete"],
  ["System test", "End-to-end workflow for each SOP and return loop", "No open critical or high defects"],
  ["User acceptance (UAT)", "Scripts per SOP run by Field Officers, Senior Team, Freelancers, Reviewer, Management, SARP Liaison, Government Officials and the SARP PMU Officer", "Signed UAT certificate from Indo-Lanka and SARP PMU"],
  ["Performance", "30 concurrent and 60 peak users; generation and AI timings", "NFR-01 and NFR-02 met"],
  ["Security", "Independent VAPT; Sri Lanka CERT assessment; configuration review", "Release criterion in SEC-TST-01 met"],
  ["Data protection", "Consent, access report, correction, anonymisation, retention job, export controls", "DPO sign-off"],
  ["Backup and recovery", "Full restore of database and documents to the isolated recovery environment", "RPO and RTO met; every restored document version matches its database record (SHA-256)"],
  ["Accessibility and devices", "Tablets, browsers, WCAG checks", "No blocking issues"],
], [0.2, 0.5, 0.3], { size: 17 });
P("**Acceptance criteria for go-live:** UAT signed; all Must requirements delivered or formally deferred by the SARP PMU; VAPT and CERT findings meet the release criterion in SEC-TST-01; DPIA approved; backup restore tested; users trained; support arrangements in place.");

// =====================================================================
// 14 IMPLEMENTATION PLAN
// =====================================================================
H1("14  Implementation plan");
P("Indicative plan of 24 weeks from mobilisation, including 4 weeks of hypercare. **Production go-live is planned for week 20 and hypercare ends in week 24.** Security testing and UAT overlap the end of the build as shown; run one after another, the phases would take 27 weeks. Dates depend on the decisions in Section 15 and on a Sri Lanka CERT assessment slot in week 17.");
TBL(["Phase", "Main activities", "Weeks", "Key deliverables"], [
  ["0  Mobilisation", "Confirm open decisions, hosting, domain, controller and processor agreements", "1–2", "Signed specification; hosting order; data processing agreement"],
  ["1  Design", "UX wireframes, data model, threat model, DPIA draft, templates; PMU approves rules F4, age band and quotas", "3–5", "Approved wireframes; DPIA draft; technical design; approved business rules"],
  ["2  Build sprint 1", "Access and users (incl. WebAuthn), SOP 01, SOP 02, audit, notifications base", "6–9", "Registration and interview modules in UAT"],
  ["3  Build sprint 2", "SOP 03 (AI payload and filter, financial model, Section 10), SOP 04 with gates", "10–13", "Proposal and document modules in UAT; payload test run"],
  ["4  Build sprint 3", "SOP 05, generation, dashboards, data protection module, admin", "14–16", "Feature-complete system in UAT (end of week 16)"],
  ["5  Security and testing", "Hardening and scans from week 15; VAPT on the feature-complete build weeks 16–17; CERT assessment week 17; performance and restore tests", "15–17 (overlaps sprint 3)", "Test reports; release criterion met"],
  ["6  UAT and training", "UAT cycles and fixes; fix and retest VAPT and CERT findings (weeks 18–19); training by role; user guides", "17–19 (starts during security testing)", "UAT certificate; training records"],
  ["7  Go-live", "Production deployment and data set-up", "20", "Go-live report"],
  ["8  Hypercare", "Close support, then handover to support", "21–24", "Hypercare closure report"],
], [0.17, 0.38, 0.15, 0.3], { size: 17 });
TBL(["Deliverable", "Description"], [
  ["Source code and deployment scripts", "In the controller's repository, with build and deployment documentation"],
  ["Technical documentation", "Architecture, data model, API (OpenAPI), configuration, operations runbook, backup and restore procedure"],
  ["Security pack", "Threat model, VAPT and CERT reports, hardening checklist, incident response plan"],
  ["Data protection pack", "DPIA, records of processing, retention schedule, consent forms (3 languages), privacy notice"],
  ["User guides and training", "Guides per role; training sessions for all 41 users"],
], [0.32, 0.68]);

// =====================================================================
// 15 OPEN DECISIONS
// =====================================================================
H1("15  Assumptions, dependencies and open decisions");
H2("15.1  Decisions needed from SARP PMU and Indo-Lanka");
P("Decisions 1, 2, 3, 8, 15 and 16 change UAT test outcomes, so the SARP PMU must approve them by the end of the design phase (week 5).");
TBL(["No.", "Decision", "Affects", "Default used in this document", "Needed by"], [
  ["1", "Quota split of 1,600 beneficiaries across the six districts", "Master data, ID, quota reports", "Districts confirmed (v1.2): Anuradhapura, Vavuniya, Mannar, Puttalam, Kurunegala, Matale; split configurable", "Week 5"],
  ["2", "Youth age band for eligibility", "Rule E1", "Configurable; no default set", "Week 5"],
  ["3", "Is LKR 2,000,000 a fixed project value or a ceiling?", "Funding rule F4", "Configurable", "Week 5"],
  ["4", "Data controller, DPO and processor agreement", "Section 8.2", "SARP PMU as controller; Indo-Lanka as processor", "Week 2"],
  ["5", "Hosting location and provider; domain (gov.lk per CERT guideline)", "Sections 8.7, 9.1, 11.4", "Sri Lanka data centre, Option B (950 GB)", "Week 2"],
  ["6", "Government Officials and PMU Officer: names, agencies, districts", "Roles GO and PMU", "3 review-stage officials + 1 PMU officer", "Week 5"],
  ["7", "Required Section 10 recommendations per business category", "FR-GOV-002", "Agriculture, Animal Production and Health, Agrarian Service Centre, Divisional Secretariat as applicable", "Week 5"],
  ["8", "Interview scorecard weights and decision bands", "Section 6.4", "20/15/20/15/15/10/5; 70 / 50 bands", "Week 5"],
  ["9", "Retention periods", "Section 8.8", "2 years unsuccessful; programme closure + 7 years approved", "Week 5"],
  ["10", "Whether to enable AI drafting: lawful basis, applicant notice or consent at proposal stage, provider and contract terms", "Sections 8.3, 8.7, 10.7", "Off; if enabled: allow-listed payload; zero data retention; no training; section 26 instrument", "Week 10"],
  ["11", "SMS gateway provider and sender ID", "Section 10.5", "Sri Lankan provider", "Week 9"],
  ["12", "Freelancer numbers (20), workload cap, Senior Team size for 1,600 interviews", "Capacity, scheduling", "20 freelancers; cap 10 open assignments", "Week 2"],
  ["13", "Maximum file size and accepted formats", "FR-DOC-002", "10 MB; PDF, JPG, PNG", "Week 5"],
  ["14", "FIDO2 security keys for privileged users (two each, about 18 keys)", "SEC-IAM-01, SEC-IAM-07", "Supplied before UAT", "Week 9"],
  ["15", "Route for applicants who answer No to Indo-Lanka consultancy consent: who prepares their proposal", "FR-PRO-012, SOP 03", "Not assigned to an Indo-Lanka freelancer; PMU decides the route", "Week 5"],
  ["16", "Confirm the DS/GN audit list (received 17 November 2026) as the eligible list, add GN numbers if available, and check one entry: GN Palleyaya is listed under Matale district, Rideegama DS, but Rideegama DS is in Kurunegala district", "FR-REG-013, master data", "Audit list built into the capture form; anything not on it is typed and flagged", "Week 5"],
], [0.05, 0.31, 0.16, 0.36, 0.12], { size: 16 });
H2("15.2  Assumptions");
BL([
  "Submission to SARP is recorded in the system; files are delivered to SARP by the existing channel.",
  "Applicants do not use the system directly in Phase 1.",
  "Users have reliable devices (laptops, 10-inch tablets) and mobile data in the field.",
  "Storage per page and per photo follows the capacity analysis assumptions.",
  "Income tax is not modelled in the financial plan.",
]);
H2("15.3  Dependencies");
BL([
  "Timely confirmation of the decisions in Section 15.1, especially hosting, controller role and districts.",
  "Sri Lanka CERT assessment slot before the planned go-live date.",
  "Availability of UAT users from each role.",
  "Signed contracts with hosting, SMS and AI providers containing the data protection terms in Section 8.",
]);

// =====================================================================
// APPENDICES
// =====================================================================
H1("Appendix A  Document checklist master");
P("Gates are defined in Section 6.7: G1 registration complete, G2 interview decision, G3 submit for verification, G4 release to management approval. The Reviewer verifies every item at G4 at the latest; Field Officers and the panel sight originals earlier where shown.");
TBL(["No.", "Document", "Mandatory", "Upload by gate", "Who can upload", "Verified by"], [
  ["1", "NIC copy (front and back)", "Yes", "G1", "Field Officer", "Original sighted by Field Officer at G1; Reviewer at G4"],
  ["2", "Signed data-use consent form", "Yes", "G1", "Field Officer", "Reviewer at G4"],
  ["3", "Land ownership or lease document", "Yes", "G2", "Field Officer, Senior Team", "Sighted by panel at interview; Reviewer at G4"],
  ["4", "Site and land photos (4, plus 2 site-visit photos)", "Yes", "G2", "Field Officer, panel", "Reviewer at G4"],
  ["5", "Business registration", "If scale-up", "G3", "Field Officer, Freelancer", "Reviewer at G4"],
  ["6", "Quotations or bill of quantities for investment items", "Yes", "G3", "Freelancer", "Reviewer at G4"],
  ["7", "Financial evidence (bank statements, existing business records)", "If scale-up or loan", "G3", "Freelancer", "Reviewer at G4"],
  ["8", "Technical permits or approvals", "If required by category", "G3", "Freelancer", "Reviewer at G4"],
  ["9", "Government recommendation letters (Section 10)", "As required by category", "G3", "Freelancer", "Reviewer at G4"],
  ["10", "Signed proposal and beneficiary declaration", "Yes", "G3 (re-signed if the proposal changes before G4)", "Freelancer, Field Officer", "Reviewer at G4"],
  ["11", "Bank account confirmation (passbook copy or bank letter)", "Yes", "G3", "Freelancer, Field Officer", "Reviewer at G4"],
  ["12", "Interview scorecard", "System-generated", "G2", "System", "Not verified (system record)"],
  ["13", "Other supporting documents", "No", "Any time before lock", "Any preparer", "Reviewer if material"],
], [0.05, 0.3, 0.12, 0.15, 0.16, 0.22], { size: 16 });
H1("Appendix B  Requirement index");
TBL(["Prefix", "Area", "Section"], [
  ["FR-UM", "Access and user management", "3.4, 5.1"],
  ["FR-REG", "SOP 01 Registration", "5.2"],
  ["FR-INT", "SOP 02 Interview and shortlisting", "5.3"],
  ["FR-PRO, FR-FIN, FR-GOV", "SOP 03 Assignment, proposal, financials, Section 10", "5.4"],
  ["FR-DOC", "SOP 04 Documents and verification", "5.5"],
  ["FR-APP", "SOP 05 Approval, submission, SARP tracking", "5.6"],
  ["FR-RPT", "Dashboards and reports", "5.7"],
  ["FR-NOT", "Notifications", "5.8"],
  ["FR-AUD", "Audit trail", "5.9"],
  ["FR-ADM", "Administration", "5.10"],
  ["FR-DP", "Data protection functions", "5.11"],
  ["SEC-*", "Cyber security", "9"],
  ["NFR", "Non-functional requirements", "12"],
], [0.25, 0.55, 0.2]);

// =====================================================================
// BUILD
// =====================================================================
const doc = new Document({
  creator: "Indo-Lanka Greenhouse and Agri Solutions (Pvt) Ltd",
  title: "SARP YED Management System: Functional and Technical Specification",
  description: "Functional and technical specification v1.2",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: C.ink } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: C.forest }, paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: C.green }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: C.ink }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }, { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 900, hanging: 270 } } } }] },
      { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      { reference: "num2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      { reference: "num3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ],
  },
  sections: (() => {
    const hdr = () => ({ default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } }, children: [new TextRun({ text: "SARP YED Management System  |  Functional and Technical Specification v1.2", size: 16, color: C.muted })] })] }) });
    const ftr = (w) => ({ default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: w }], children: [new TextRun({ text: "Confidential", size: 16, color: C.muted }), new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: C.muted })] })] }) });
    const portrait = { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };
    const landscape = { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } };
    const a = body.indexOf("__LS_START__"), b = body.indexOf("__LS_END__");
    return [
      { properties: { page: portrait }, children: cover },
      { properties: { page: Object.assign({ pageNumbers: { start: 1 } }, portrait) }, headers: hdr(), footers: ftr(W), children: [...front, ...body.slice(0, a)] },
      { properties: { page: landscape }, headers: hdr(), footers: ftr(16838 - 2000), children: body.slice(a + 1, b) },
      { properties: { page: portrait }, headers: hdr(), footers: ftr(W), children: body.slice(b + 1) },
    ];
  })(),
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(DIR, "SARP_YED_Functional_Technical_Specification_v1.2.docx"), b); console.log("ok"); });
