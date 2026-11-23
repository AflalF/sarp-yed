# SARP YED Management System: data capture form, demo and specification

Work for Indo-Lanka Greenhouse and Agri Solutions (Pvt) Ltd, technical consultants to the Youth Enterprise Development (YED) component of SARP (Smallholder Agribusiness and Resilience Project, Ministry of Agriculture / IFAD).

This repository contains no applicant data. Never commit capture backups or Excel exports.

## Online

- Main page: https://aflalf.github.io/sarp-yed/
- Demo: https://aflalf.github.io/sarp-yed/demo/sarp-yed-demo.html
- Capture form: https://aflalf.github.io/sarp-yed/capture-form/SARP_YED_Data_Capture.html (for showing the form; use the downloaded file for real data)

## What is here

| Folder | Contents |
| --- | --- |
| `capture-form/` | `SARP_YED_Data_Capture.html`: offline pre-registration capture form (single file, Chrome or Edge). `ds_gn_audit_list.json`: the DS/GN audit list built into the form (6 districts, 61 DS, 1,604 GN). |
| `demo/` | `sarp-yed-demo.html`: clickable demo of the full management system (9 roles, 31 fictional applicants, capture import), aligned to specification v1.2. |
| `docs/` | Functional and technical specification v1.2, capture-form QA results, demo script. |
| `tests/capture-form/` | Playwright tests for the capture form, including the 85-applicant run and cell-by-cell Excel check. |
| `tests/demo/` | Playwright QA suite for the demo (62 scenarios). |
| `tools/` | `build_spec.js`: generates the specification Word file (docx-js) from the images in `tools/assets`. |

## Using the files

- **Capture form and demo:** download the `.html` file and open it in Chrome or Edge. No server or internet needed. Data stays in that browser until exported.
- **User guide for the capture form:** see the separate guide document shared with the team.

## Running the tests

Requires Node.js 18+ and Playwright (`npm i -D playwright && npx playwright install chromium`).

```bash
# demo QA suite (62 scenarios)
node tests/demo/qa_suite.js

# capture form suites
mkdir -p tests/capture-form/out
node tests/capture-form/t3.js      # dropdowns and audit list
node tests/capture-form/t5.js      # session setup
node tests/capture-form/t6.js      # manual GN number

# 85-applicant run and Excel check (needs a local web server for the folder auto-save test)
cd capture-form && python3 -m http.server 8765 &   # from the repository root
cd tests/capture-form && python3 gen.py && node run85.js && python3 compare.py
```

`t2.js` also needs `tests/capture-form/out/gn_list.xlsx` (a small 4-column GN list) and `run85.js` writes `out/folder_backup.json`, which the demo's import tests read.

## Building the specification

```bash
cd tools && npm i docx && node build_spec.js
```

The script expects the images in `assets/` next to it (adjust paths at the top of the script if you move them).

## Status

- Capture form: version 2 (17 November 2026), 141 of 141 tests passed.
- Demo: aligned to specification v1.2 (23 November 2026), 62 of 62 tests passed.
- Open decisions are listed in Section 15 of the specification.
