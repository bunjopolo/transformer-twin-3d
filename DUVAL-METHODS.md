# Duval implementation and validation

Implemented in `dist/duval.js`; chart rendering and replay in `dist/dga.js`.

## Reference editions

- [IEEE C57.104-2019 supplementary workbooks](https://standards.ieee.org/content/dam/ieee-standards/standards/web/download/C57.104-2019_downloads.zip): `DuvalTriangles1_7-29Mar2016.xls` and `DuvalPentagons1-2_Aug2016.xls`. The triangle formulas and plotted boundary definitions were inspected directly. The pentagon calculation and coordinate cells were inspected directly. The reference files are not bundled with the app.
- [Michel Duval, IEEE Electrical Insulation Magazine 24(6), 22–29 (2008), DOI 10.1109/MEI.2008.4665347](https://doi.org/10.1109/MEI.2008.4665347), especially Tables 2–3 for LTC and fluid-specific boundaries. [Readable paper mirror](https://es.scribd.com/document/483237157/Triangulo-de-Duval).
- [IEEE C57.104 working-group presentation, Spring 2025](https://grouper.ieee.org/groups/transformers/subcommittees/fluids/C57.104/S25-C57.104-MtgPresentation.pdf): identifies errors in the printed Triangle 4/5 tables and provides numerical regression examples. It also discusses proposed geometry and applicability changes; those proposals are not treated as adopted standards.
- [Cheim, Duval and Haider, Combined Duval Pentagons (2020)](https://doi.org/10.3390/en13112859): area-centroid method, gas-axis order and numerical example. The dashboard displays Pentagon 1 alongside Triangles 1, 4 and 5.
- Existing Triangle 1 geometry is retained from [Table 3, IJEPE 4(3), 193–197 (2010)](https://www.makhillpublications.co/public/files/published-files/mak-ijepe/2010/3-193-197.pdf).

## Choices that affect results

All charts use one set of polygons for both drawing and classification. Shared boundaries report every adjacent region instead of selecting a single fault through spreadsheet formula precedence. This intentionally differs from single-label spreadsheet boundary results. ND is an explicit undetermined region, not a healthy condition.

Triangle 2 implements the conventional compartment-type, oil-arcing LTC chart. It is not the model-specific Triangle 2a–2e family. The source selection must explicitly identify an LTC sample. When both ethylene and acetylene are below 10 ppm, classification is suppressed following Duval's 2008 advice. The app cannot infer equipment type from gas concentrations.

Triangle 3 requires Silicone, MIDEL 7131, FR3 or BIOTEMP. The D1/D2, T1/T2 and T2/T3 ethylene limits respectively are (9,16,46), (26,39,68), (25,43,63) and (20,52,82). The paper describes 46, 68 and 82 as extrapolated. Fluid-correct gas extraction is a laboratory responsibility. BIOTEMP's workbook drawing uses 81 where its formulas and the paper specify 82. Its formulas also omit a narrow DT strip with ethylene above 82% and acetylene above 15%. We use the paper's 82% threshold and unchanged remaining Triangle 1 boundaries to close that strip; this is documented rather than silently reproducing a blank spreadsheet result.

Triangles 4 and 5 use the March 2016 reference workbook geometry, including Triangle 5's 49% ethylene step and 15% ethane PD/S boundary. They do not use the erroneous printed 2019 tables. Triangle 4 requires a simultaneous Triangle 1 result entirely within PD/T1/T2; Triangle 5 requires T2/T3. A primary boundary touching an excluded zone is insufficient. The proposed 2020/2025 removal of T2 from Triangle 4's scope is not applied to this explicitly dated edition.

Pentagon zones use the coherent August 2016 workbook coordinates, not a mixture of the 2014 article, rounded 2019 printed tables and 2025 proposals. Pentagon 1's T1 region is closed by its shared S, T2, T3 and D2 edges. The gas order is H2, C2H6, CH4, C2H4, C2H2, counterclockwise from the top. Percentages are projected along unit radial axes; the shoelace area centroid is used without rounding. The chart displays Cartesian centroid coordinates; it is not a linear weighted average or a gas-percentage radar chart. Near-zero polygon area and points outside reference polygons return an explicit unavailable result.

The reference pentagon workbook asks for laboratory detection limits for zero readings and internally floors inputs at 0.1 ppm. This app never silently alters imported measurements: positive inputs are used as supplied; a zero input requires a laboratory-approved positive detection-limit value before a pentagon result is available. Missing readings are never treated as zero.

## Data and interface

Gas mapping and existing local import persistence remain in place. Every required gas must have the same timestamp, finite non-negative actual concentration and ppm unit. Duplicate required-gas records invalidate the timestamp. Triangles 4/5 additionally require all Triangle 1 prerequisite gases at that timestamp. A newer partial sample clears the selected point; historical valid samples remain, with gaps in the trajectory across invalid samples.

The diagram and sample-source selectors pause replay. Source selection describes the mapped dataset, not a conversion of the gases to another compartment or fluid. Sample source resets to the app's original mineral-oil main-tank default after saving/importing data and on page reload, avoiding reuse of an alternative-fluid or LTC assumption across imports. The main tank's actual fluid must still be confirmed by the user.

A region is a fault-type indication, not proof that a fault exists, a severity score or a measured temperature. Absolute concentrations, gas production rates, laboratory detection limits and equipment history remain necessary. Zone C indicates possible paper involvement, not certainty.

## Verification

Run:

```sh
node test-dga.cjs
node test-duval-methods.cjs
node test-imports.cjs
node test-smartsignal.cjs
```

The added suite covers 41,208 integer gas compositions across eight triangle configurations; all polygon vertices; 280 independently evaluated, deterministic reference-workbook cases; all 29 Triangle 4/5 correction examples in the 2025 presentation; centroid checks; scaling; invalid data; timestamp alignment; prerequisite gating; all fluid variants; and generated UI markup.

During development, a restricted Excel-expression interpreter compared 28,000 non-boundary samples with the actual reference formulas. All 27,997 cases with spreadsheet results matched; three BIOTEMP spreadsheet blanks were in the documented omitted DT strip. No workbook macros were executed. The retained 280 fixtures include their source attribution in `test-duval-reference.json`.

These checks establish the implemented edition and observed behavior. They do not establish industrial certification or guarantee the absence of every possible defect.
