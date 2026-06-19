# hospital-lab-viewer

<!-- 門診衛教單列印 Chrome 擴充功能 -->

Chrome MV3 extension for generating printable patient lab-report handouts
from the hospital ernode API. Used at 臺北榮民總醫院玉里分院 (vhyl) and
臺東分院 (vhtt) outpatient clinics.

## What it does

OPD doctor opens any patient's lab order page on the intranet → clicks the
extension icon → gets a printable handout (color or B&W, A4 landscape,
multi-patient batch supported).

## File layout

```
hospital-lab-viewer/
├── manifest.json             ← Chrome extension manifest (MV3)
├── popup.html / popup.js     ← Extension popup UI (search, tables, print)
├── report.js                 ← Printable report builder (A4 landscape)
├── pattern-loader.js         ← Runtime fetch dist/patterns.json + 24h cache
├── mapping.js                ← AUTO-GENERATED — bundled patterns (fallback)
├── normalizers.js            ← AUTO-GENERATED — unit transforms
├── patterns-computed.js      ← AUTO-GENERATED — eGFR, CKD staging, hepatitis
├── options.html / options.js ← Extension settings (API URL, OPSID)
├── report-viewer.html/js     ← iframe-based report viewer for printing
├── sync-patterns.js          ← Sync tool: regenerates mapping/normalizers/computed
├── ckd_staging.svg / .png    ← CKD staging logic reference diagram
├── CLAUDE.md                 ← Per-repo rules for Claude
└── WORKLOG.md                ← Change log (繁體中文)
```

## Pattern source

All regex patterns, reference ranges, and computed values come from the
sibling repo [`hospital-lab-patterns`](https://github.com/Yuchunchen/hospital-lab-patterns).
**Do NOT hand-edit** `mapping.js`, `normalizers.js`, or `patterns-computed.js` —
they are overwritten by `node sync-patterns.js`.

The extension also fetches `dist/patterns.json` from GitHub at runtime
(24h cache), so OPD machines get pattern updates without reloading.

## Quick start

```powershell
# After pattern changes in hospital-lab-patterns:
node sync-patterns.js

# Load into Chrome (each machine pulls from GitHub, no zip):
# chrome://extensions → Load unpacked → select this folder
```

## Key features

- **Two print modes**: 🎨 Color (red=high, blue=low) / 🖨️ B&W (bold+underline / bold+italic)
- **Multi-patient batch**: Comma/space-separated chart numbers
- **Kidney disease staging**: eGFR → CKD stage → KDIGO risk → Taiwan CKD → Early CKD class
- **Hepatitis display**: HBsAg / Anti-HBs / HCV via computed dispatcher (qualitative + titer)
- **Gender-aware thresholds**: loM/hiM/loF/hiF alarm logic
- **HIV section**: Toggle via checkbox (HIV load, CD4, RPR, TPHA)
- **Reminder box**: Lists recent labs not captured by patterns

## Privacy

Never commit real chart numbers, patient names, or API responses.
The `examples/` folder is gitignored.

## License

Proprietary / internal use.
