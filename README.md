# Transformer Twin

Static hydro generation transformer prototype. Serve `dist/` with any HTTP server (for example `python3 -m http.server 4173 --directory dist`). The monitoring views need no backend. Shared maintenance folders use Netlify Functions and Netlify Blobs; deploy with the project’s Netlify configuration to enable them.

## Development

Use Node.js 22.13.0 or later. Install the locked dependencies with `npm ci`, then run all regression suites with `npm test`. On macOS, `Preview 3D.command` starts the local static preview. See [NETLIFY.md](NETLIFY.md) for the protected maintenance service and deployment setup.

`dist/` contains the maintained application source and vendored browser dependencies; it is required in Git and is not disposable build output. `models/` contains the editable Blender model and its generator. Keep the vendor license files and `test-duval-reference.json` with the project. Local dependencies, Netlify state, environment files, and editor/OS artifacts are ignored.

Includes interactive SVG transformer, actual/predicted trends, source advisory highlighting, advisories, maintenance records, Excel/CSV imports with column mapping and validation, data export, and local browser persistence.

The primary import accepts the described GE SmartSignal offline export: one worksheet per tag, with Timestamp, Actual, Estimate, Advisory Indication and Diagnostic Advisory Indication. Each worksheet name is the tag ID. Configure its component, optional display name/unit, header row and column mapping, then apply all selected tags in one operation. Residual and smoothed-residual columns are ignored. Extra worksheets can be excluded. The example workbook is synthetic, based on the user's description, not an actual SmartSignal export.

Both indication columns contain text. Non-empty messages are displayed verbatim and highlight the associated component. Blank cells show “None supplied”; unmapped columns remain unknown. Diagnostic text is not interpreted or converted into severity or a numerical health score. No predictive inference is performed on SmartSignal indications. The DGA page separately calculates Duval Triangle 1, 4 and 5 and Pentagon 1 regions for the main transformer oil tank. Example strings include “LOW_TAG fired for MCA_U02_GenAirCW_Flow_00” and “Sensor Failure - Gen CW Flow”.

Choose ISO, month/day/year, or day/month/year for textual timestamps and a fixed timezone offset for timestamps without one. Excel date serials respect the workbook's 1900/1904 epoch. Explicit timestamp offsets are preserved. Fixed offsets do not adjust for DST; split exports spanning a change or use explicit offsets. All display timestamps are UTC. The actual export's precise timestamp format has not been provided.

Use “Maintenance template” for maintenance document records, including engineer-completed equipment health ratings, or a normalized Sensors backup. Maintenance records require component, title and content; categories are deferred. Equipment health ratings are not calculated, aggregated, displayed as scores or used to color components. The overlay shows only whether source advisory text is supplied, not equipment condition. The first import removes demonstration data; later tag imports retain imported maintenance records. Legacy numerical health data remains available in backups for compatibility, but is not used by the app. Limits: 10 MB/file, 20,000 readings/tag, 100,000 readings/workbook.

Checks: `node test-imports.cjs` and `node test-smartsignal.cjs`. These cover parsing a round-tripped XLSX workbook, column mapping, independent advisory text, missing vs blank indications, zero readings, timestamps, duplicates, browser-state persistence logic, and preservation of maintenance/health data. Browser QA also covers the example workbook's full import and reload.

Maintenance folders can contain original PDF, Word, spreadsheet, image and text files. The Maintenance worksheet remains available for legacy browser-local text records. The model and asset metadata are illustrative and need adaptation to the actual transformer. Browser storage is specific to the browser and site origin; sensor imports have no shared database or live connections. Maintenance folder uploads are shared through the protected Netlify document service; sensor workbooks remain browser-local. Interface fonts are loaded from Google Fonts with system fallbacks.

Excel support uses vendored SheetJS CE 0.20.3, Apache-2.0 license. https://docs.sheetjs.com/

## Transformer 1, Phase A

The starting catalog has 21 measurements: generator volts (Phase A), generator current, cooling-water inlet temperature, transformer cooling-water flow, Phase A winding temperature; water in oil, hydrogen, acetylene, carbon dioxide, carbon monoxide, total combustible gas, ethane, ethylene, methane, nitrogen and oxygen concentrations; and acetylene, ethane, ethylene, methane and hydrogen concentration rates of change. The dashboard represents one single-phase transformer.

Sample workbook IDs are placeholders, not confirmed historian tag names. Sample electrical/temperature/concentration units are kV, A, °C and ppm. Cooling-water flow is displayed without a unit. The five gas rates of change use the confirmed unit ppm/month. Units and component assignments remain editable during import. Exact matches to the configured example IDs or measurement names prefill the mapping; unknown tags remain supported.

## DGA monitoring and workbook replay

The DGA monitoring tab includes all 11 concentration channels and five rate-of-change channels. Import a workbook, open DGA monitoring, check gas tag mapping, then expand the discreet Demo controls section in the sidebar and press Play. Playback starts from the beginning when positioned at the end; Restart pauses at the first sample. Pause, scrub and speed selection (1×, 10×, 60×, 600×, 3,600×, 86,400×) use elapsed wall-clock time. The default 3,600× advances one recorded hour per second. The sample values, Duval point, trajectory, source messages and selected gas trend follow the same replay clock. Switching pages, importing data or editing tag mapping stops playback. All gas trends are shown in one full-width column and follow the replay clock.

This is workbook replay, not an online connection or interpolated simulation. The latest measurements are held until newer records arrive; their timestamps remain visible. Browser-local gas channel mapping supports custom historian tag IDs, prevents reuse of one tag for multiple channels and is persisted with the data. Unknown or ambiguous channels require explicit mapping.

Duval Triangle 1 is implemented for mineral-oil main-tank DGA, using actual CH4, C2H4 and C2H2 in ppm. Samples must have exactly matching timestamps (equivalent timezone offsets are normalized). Missing, invalid, negative, duplicate or zero-total triplets are not classified. A newer incomplete triplet removes the selected point rather than combining older gas readings. The previous valid samples remain in the historical trail. Shared polygon boundaries show all adjacent regions. A plotted region is a potential fault type, not proof of a fault, a severity rating or a measured temperature. Interpret it with absolute concentrations, rates and transformer history.

Zone geometry: [International Journal of Electrical and Power Engineering 4(3), 193–197 (2010), Table 3](https://www.makhillpublications.co/public/files/published-files/mak-ijepe/2010/3-193-197.pdf). See also [Vaisala interpretation guidance](https://www.vaisala.com/en/calculators/dgacalculator). Run `node test-dga.cjs` for zone interiors, shared boundaries, full integer-composition coverage, invalid samples, timestamp alignment, playback clock scaling and integration checks.


## Additional Duval methods

DGA monitoring displays Triangles 1, 4 and 5 and Pentagon 1 together for the mineral-oil main transformer tank, with a shared gas concentration strip and replay clock. There is no diagram or sample-source selector. Tap-changer and alternative-fluid comparisons are omitted from this asset dashboard. Triangles 4/5 require applicable, simultaneous Triangle 1 results. Every chart shows its own sample timestamp, region, percentages and history. Classification series are cached between replay ticks and invalidated when imported data or tag mappings change.

See [DUVAL-METHODS.md](DUVAL-METHODS.md) for source editions, source inconsistencies, applicability, zero/detection-limit handling and verification. Run `node test-duval-methods.cjs` in addition to the existing tests. The implementation uses the IEEE-distributed 2016 workbook edition and explicitly reports shared boundaries. It does not claim to implement every proposed later revision.

## Interactive 3D branch

`codex/interactive-3d` adds a local, Blender-authored GLB model with six selectable component groups. Drag to orbit, scroll/pinch or use +/− to zoom, and click a visible part or component button to select it. Arrow keys rotate the focused canvas; Home resets the view. Cutaway removes the front wall, lid, lid bolts, lifting lugs, front stiffeners and nameplate as one assembly to reveal the core and windings. Removal membership is exported as `hideInCutaway` metadata. Selecting the windings opens the cutaway. The orthographic camera survives component selection, snapshot updates and page navigation. Neutral grey materials, sharper chamfers, technical edge lines and a reference grid give the model a CAD appearance. A 2D view remains available when WebGL is unsupported.

Hover identifies the component under the pointer. Clicking a visible mesh selects it and brings the shared details panel into view when it is off-screen; drag/pinch gestures do not select. Both views call the same component selection function and use the same snapshots, source advisories, trends, imports, maintenance records and DGA pages. Amber tint indicates supplied source advisory text, not inferred equipment health. Geometry is illustrative and is not a dimensionally accurate reconstruction of the installed unit.

Editable source: `models/transformer.blend`. Regenerate both source and web asset with `/Applications/Blender.app/Contents/MacOS/Blender --background --python models/build_transformer.py`. The script runs in a separate Blender process. Component IDs live on parent objects as glTF extras; preserve them when editing. The browser loads `dist/models/transformer.glb`; all Three.js 0.180.0 modules are vendored locally with their MIT license.

Run locally: `python3 -m http.server 4174 --bind 127.0.0.1 --directory dist`, then visit http://127.0.0.1:4174. This branch has not been deployed to the existing Site. Browser-local storage is scoped to its preview origin; import or restore a backup there to use an existing dataset.

Validation: the four original regression suites plus `node test-3d.cjs`. Browser checks cover model loading, direct mesh selection for all six components, rotation without selection, cutaway hardware, component details/maintenance and matching 2D/3D details. `test-3d.cjs` also covers hidden-geometry picking, occlusion and click/drag/pinch/cancel gestures.

### Model tag readouts

Hover over a model part to see up to three assigned tags with actual values, units, tag IDs and UTC sample timestamps from the dashboard's selected snapshot. The card identifies demo/imported data and links the interaction to the shared component details. Focus a component button for the same preview; Escape dismisses it. Clicking a component (including on touch devices) reveals all mapped tags in its details panel; selecting a tag opens its actual-versus-estimate trend. Components without readings show an empty state, and missing units are explicitly marked.

The current winding catalog includes generator voltage, generator current and Phase A winding temperature. These are component-level tags, not separate HV/LV-coil measurements; generator voltage is not relabelled as an HV-coil measurement. Cooling has inlet temperature and water flow; the tank has oil/gas concentrations and gas rates. Imported custom tags follow their assigned component. No new readings are simulated and no live connection is implied. Historical snapshots use the latest available reading at or before the selected time, preserving each tag's own sample timestamp.

Additional regression suite: `node test-model-tags.cjs` covers snapshot cutoffs, custom mappings, zero/missing readings, missing units, all-tag access and escaped import content. Browser verification covers readout rendering, historical-value changes and tag-to-trend navigation.

### Single-phase terminal arrangement

The illustrative model now has two tall high-voltage bushings marked H1/H2 and two shorter low-voltage bushings marked X1/X2, rather than an ambiguous three-terminal arrangement. The 2D fallback uses the same terminal pairs. Each terminal is a named child of the existing `bushings` component, with `terminalId` and `voltageSide` glTF extras; tag mappings, hover readings and component selection remain shared. Older imports using the label “HV bushings” are still accepted.

This is a generic single-phase two-winding arrangement, not a confirmed as-built terminal/neutral arrangement for the installed Federal Pioneer unit. Terminal convention reference: [Hammond Power Solutions — subtractive polarity](https://americas.hammondpowersolutions.com/resources/faq/definition/what-is-subtractive-polarity). The GLB regression check verifies exactly H1/H2 as HV and X1/X2 as LV, their visible markings and their component ancestry.

## Shared maintenance folders

In Maintenance library, choose Upload folder, select the pre-organized directory,
and review the upload. Original filenames and relative folder paths are retained;
empty directories and operating-system metadata files are omitted. There is no
required category naming scheme. Standards, instructions, inspection reports and
history can remain in the folders you already use.

Select a folder or file, check one or more components, then Save assignments.
Folder assignments apply to all current files in that folder and its descendants.
New files start unassigned. Same-path replacements retain existing assignments;
replacement requires a review, and files absent from a later upload are retained.
Tank and insulating oil are separate assignment targets. The model’s Main tank &
oil document shortcut includes both. Component shortcuts open a filtered file tree.

Files and assignments are shared for everyone who knows the site login. Sensor
workbooks and legacy spreadsheet text records continue to stay browser-local.
There are no separate viewer/editor roles in this prototype. The initial hosted
library is empty; no real maintenance documents or QA fixtures are deployed.

PDF, common raster-image and text previews are supported. Word, Excel and other
formats can be downloaded to open in their own applications. Text previews show
up to 2 MB. Original documents are retained without parsing or rewriting content.

Limits: 50 MB/file, 200 MB and 1,000 files/upload, 2,000 files/library. Uploads use
2 MB parts. The folder appears only after every part has been validated; failure
or cancellation leaves the published index unchanged. Concurrent metadata updates
use conditional writes. The same password is checked independently in the server
function, including direct function URLs. API responses and files are not cached.

Shared data uses the site-scoped, strongly consistent `maintenance-library-v1`
Netlify Blobs store and survives app redeploys. Partially staged uploads after a
closed browser and superseded file blobs may require administrator cleanup; no
automatic deletion or version-history UI is included. Folder uploads consume the
existing Free plan’s request, storage/bandwidth and function allowances.

Run `node test-maintenance.mjs` for folder validation, authorization, chunked
uploads, atomic publication, replacements, concurrent assignments and UI escaping.
Local browser QA uses synthetic files and an in-memory copy of the service, never
real documents in the production library.

## Tag trend dashboard

The overview shows every imported tag in a single column of full-width charts, with actual and estimated values over a shared 24-hour window. DGA monitoring likewise shows all gas channels without a trend dropdown. Model tag buttons scroll to the corresponding overview chart.

## DGA alarm settings

Settings provides optional upper warning and alarm thresholds for mapped DGA concentration and rate tags. Blank limits are off; enabled readings trigger at or above the threshold. Alarm must exceed warning when both are provided. Configuration is saved separately in this browser by tag ID and unit; changed units require new limits. Local statuses appear on tag charts and the DGA readings table at the selected snapshot/replay time, independently of source advisories and Duval classification. No thresholds are supplied by default. Run `node test-alarm-settings.cjs` to check validation, evaluation and persistence.

## Duval movement over time

Each diagram colours its trajectory by sample time (blue earlier, orange later), with explicit date endpoints. The trail uses the latest 1,000 samples at or before replay time and never connects across invalid samples. Selected samples include absolute gas concentrations. The classification-change timeline includes unavailable/not-applicable intervals; selecting a transition pauses replay and synchronizes all diagrams and readings. Colours indicate time, not severity. Run `node test-duval-movement.cjs`.

## Correlations

The Correlations tab displays Pearson correlations between actual readings for every imported tag over a user-selected start/end date range (both full days included in UTC), capped at the shared snapshot during replay. Exact timestamps are matched pairwise; invalid and duplicate readings are excluded, with at least three pairs and nonzero variance required. Cells show r; hover or select for matched count and a scatter plot. Playback advances one recorded timestamp per second and stops when leaving the tab. This is imported-data replay, not a live historian feed. Run `node test-correlations.cjs`.
