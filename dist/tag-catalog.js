'use strict';
// Starting tag list for Transformer 4, Phase A. IDs are demo workbook names.
const TAG_CATALOG = [
  ['GEN-V-A','Generator volts — Phase A','windings',16.1,16,'kV','Electrical'],
  ['GEN-I','Generator current','windings',9500,9480,'A','Electrical'],
  ['CW-IN-T','Cooling water inlet temperature','cooling',18.6,18.4,'°C','Cooling'],
  ['CW-FLOW','Transformer cooling water flow','cooling',280,310,'','Cooling'],
  ['WTI-01','Winding temperature — Phase A','windings',82.4,76.1,'°C','Winding temperature'],
  ['DGA-H2O','Water in oil concentration','tank',12,11.8,'ppm','DGA concentrations'],
  ['DGA-H2','Hydrogen concentration','tank',42,40,'ppm','DGA concentrations'],
  ['DGA-C2H2','Acetylene concentration','tank',.4,.4,'ppm','DGA concentrations'],
  ['DGA-CO2','Carbon dioxide concentration','tank',820,815,'ppm','DGA concentrations'],
  ['DGA-CO','Carbon monoxide concentration','tank',110,108,'ppm','DGA concentrations'],
  ['DGA-TCG','Total combustible gas concentration','tank',191.4,186.8,'ppm','DGA concentrations'],
  ['DGA-C2H6','Ethane concentration','tank',8,7.8,'ppm','DGA concentrations'],
  ['DGA-C2H4','Ethylene concentration','tank',11,10.6,'ppm','DGA concentrations'],
  ['DGA-CH4','Methane concentration','tank',20,20,'ppm','DGA concentrations'],
  ['DGA-N2','Nitrogen concentration','tank',42000,41800,'ppm','DGA concentrations'],
  ['DGA-O2','Oxygen concentration','tank',3200,3180,'ppm','DGA concentrations'],
  ['ROC-C2H2','Acetylene concentration rate of change','tank',.01,.01,'ppm/month','DGA rates of change'],
  ['ROC-C2H6','Ethane concentration rate of change','tank',.12,.1,'ppm/month','DGA rates of change'],
  ['ROC-C2H4','Ethylene concentration rate of change','tank',.18,.16,'ppm/month','DGA rates of change'],
  ['ROC-CH4','Methane concentration rate of change','tank',.22,.2,'ppm/month','DGA rates of change'],
  ['ROC-H2','Hydrogen concentration rate of change','tank',.35,.3,'ppm/month','DGA rates of change']
];
function catalogTag(name) {
  const key=String(name).toLowerCase().replace(/[^a-z0-9]/g,'');
  return TAG_CATALOG.find(r=>[r[0],r[1]].some(v=>v.toLowerCase().replace(/[^a-z0-9]/g,'')===key));
}
