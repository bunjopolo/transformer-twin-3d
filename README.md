# Transformer Twin

Static hydro generation transformer prototype. Serve `dist/` with any HTTP server (for example `python3 -m http.server 4173 --directory dist`). No build step or backend required.

Includes interactive SVG transformer, actual/predicted trends, component health, advisories, maintenance records, Excel/CSV imports with column mapping and validation, data export, and local browser persistence.

The primary import accepts the described GE SmartSignal offline export: one worksheet per tag, with Timestamp, Actual, Estimate, Advisory Indication and Diagnostic Advisory Indication. Each worksheet name is the tag ID. Configure its component, optional display name/unit, header row and column mapping, then apply all selected tags in one operation. Residual and smoothed-residual columns are ignored. Extra worksheets can be excluded. The example workbook is synthetic, based on the user's description, not an actual SmartSignal export.

Both indication columns contain text. Non-empty messages are displayed verbatim and highlight the associated component. Blank cells show “None supplied”; unmapped columns remain unknown. Diagnostic text is not interpreted or converted into severity or a numerical health score. No predictive inference is performed on SmartSignal indications. The DGA page separately calculates Duval Triangle 1, 4 and 5 and Pentagon 1–2 regions for the main transformer oil tank. Example strings include “LOW_TAG fired for MCA_U02_GenAirCW_Flow_00” and “Sensor Failure - Gen CW Flow”.

Choose ISO, month/day/year, or day/month/year for textual timestamps and a fixed timezone offset for timestamps without one. Excel date serials respect the workbook's 1900/1904 epoch. Explicit timestamp offsets are preserved. Fixed offsets do not adjust for DST; split exports spanning a change or use explicit offsets. All display timestamps are UTC. The actual export's precise timestamp format has not been provided.

Use “Maintenance / health template” for separate Maintenance and Health sheets, or a normalized Sensors backup. The first import removes all demonstration data. Later tag-workbook imports replace sensors while retaining imported maintenance/health; tag-component assignments are remembered. Limits: 10 MB/file, 20,000 readings/tag, 100,000 readings/workbook. No supplied numerical health ratings means no health score is displayed. The headline health rating is the lowest available component score, with coverage alongside it.

Checks: `node test-imports.cjs` and `node test-smartsignal.cjs`. These cover parsing a round-tripped XLSX workbook, column mapping, independent advisory text, missing vs blank indications, zero readings, timestamps, duplicates, browser-state persistence logic, and preservation of maintenance/health data. Browser QA also covers the example workbook's full import and reload.

Maintenance instructions are imported as text in the Maintenance sheet, not as PDF/Word attachments. The model and asset metadata are illustrative and need adaptation to the actual transformer. Browser storage is specific to the browser and site origin; this prototype has no shared database or live connections. No telemetry or uploaded content is sent to a server. Interface fonts are loaded from Google Fonts with system fallbacks.

Excel support uses vendored SheetJS CE 0.20.3, Apache-2.0 license. https://docs.sheetjs.com/

## Transformer 4, Phase A

The starting catalog has 21 measurements: generator volts (Phase A), generator current, cooling-water inlet temperature, transformer cooling-water flow, Phase A winding temperature; water in oil, hydrogen, acetylene, carbon dioxide, carbon monoxide, total combustible gas, ethane, ethylene, methane, nitrogen and oxygen concentrations; and acetylene, ethane, ethylene, methane and hydrogen concentration rates of change. The dashboard represents one single-phase transformer.

Sample workbook IDs are placeholders, not confirmed historian tag names. Sample electrical/temperature/concentration units are kV, A, °C and ppm. Cooling-water flow is displayed without a unit. The five gas rates of change use the confirmed unit ppm/month. Units and component assignments remain editable during import. Exact matches to the configured example IDs or measurement names prefill the mapping; unknown tags remain supported.

## DGA monitoring and workbook replay

The DGA monitoring tab includes all 11 concentration channels and five rate-of-change channels. Import a workbook, open DGA monitoring, check gas tag mapping, then expand the discreet Demo controls section in the sidebar and press Play. Playback starts from the beginning when positioned at the end; Restart pauses at the first sample. Pause, scrub and speed selection (1×, 10×, 60×, 600×, 3,600×, 86,400×) use elapsed wall-clock time. The default 3,600× advances one recorded hour per second. The sample values, Duval point, trajectory, source messages and selected gas trend follow the same replay clock. Switching pages, importing data or editing tag mapping stops playback. Opening the trend selector pauses replay so the control stays usable.

This is workbook replay, not an online connection or interpolated simulation. The latest measurements are held until newer records arrive; their timestamps remain visible. Browser-local gas channel mapping supports custom historian tag IDs, prevents reuse of one tag for multiple channels and is persisted with the data. Unknown or ambiguous channels require explicit mapping.

Duval Triangle 1 is implemented for mineral-oil main-tank DGA, using actual CH4, C2H4 and C2H2 in ppm. Samples must have exactly matching timestamps (equivalent timezone offsets are normalized). Missing, invalid, negative, duplicate or zero-total triplets are not classified. A newer incomplete triplet removes the selected point rather than combining older gas readings. The previous valid samples remain in the historical trail. Shared polygon boundaries show all adjacent regions. A plotted region is a potential fault type, not proof of a fault, a severity rating or a measured temperature. Interpret it with absolute concentrations, rates and transformer history.

Zone geometry: [International Journal of Electrical and Power Engineering 4(3), 193–197 (2010), Table 3](https://www.makhillpublications.co/public/files/published-files/mak-ijepe/2010/3-193-197.pdf). See also [Vaisala interpretation guidance](https://www.vaisala.com/en/calculators/dgacalculator). Run `node test-dga.cjs` for zone interiors, shared boundaries, full integer-composition coverage, invalid samples, timestamp alignment, playback clock scaling and integration checks.


## Additional Duval methods

DGA monitoring displays Triangles 1, 4 and 5 and Pentagons 1 and 2 together for the mineral-oil main transformer tank, with a shared gas concentration strip and replay clock. There is no diagram or sample-source selector. Tap-changer and alternative-fluid comparisons are omitted from this asset dashboard. Triangles 4/5 require applicable, simultaneous Triangle 1 results. Every chart shows its own sample timestamp, region, percentages and history. Classification series are cached between replay ticks and invalidated when imported data or tag mappings change.

See [DUVAL-METHODS.md](DUVAL-METHODS.md) for source editions, source inconsistencies, applicability, zero/detection-limit handling and verification. Run `node test-duval-methods.cjs` in addition to the existing tests. The implementation uses the IEEE-distributed 2016 workbook edition and explicitly reports shared boundaries. It does not claim to implement every proposed later revision.
