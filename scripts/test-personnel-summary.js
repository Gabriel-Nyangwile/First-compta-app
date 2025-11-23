#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const res = await fetch('http://localhost:3000/api/personnel/summary');
  assert(res.ok, 'personnel summary endpoint failed');
  const json = await res.json();
  assert(json.headcount, 'missing headcount');
  const hc = json.headcount;
  const needNums = ['total','active','hiresYtd','exitsYtd','hiresMonth','exitsMonth','turnoverMonth','turnoverYtd'];
  for(const k of needNums){
    assert(typeof hc[k] === 'number', `headcount.${k} not number`);
    assert(!Number.isNaN(hc[k]), `headcount.${k} is NaN`);
  }
  assert(json.contracts?.totals, 'missing contracts.totals');
  ['CDI','CDD','CI','UNKNOWN'].forEach(k=>{
    assert(typeof json.contracts.totals[k] === 'number', `contracts totals ${k} not numeric`);
  });
  // Percentages
  assert(json.contracts?.percentages, 'missing contracts.percentages');
  ['CDI','CDD','CI','UNKNOWN'].forEach(k=>{
    const v = json.contracts.percentages[k];
    assert(typeof v === 'number', `percentage ${k} not number`);
    assert(v >= 0 && v <= 100, `percentage ${k} out of range`);
  });
  assert(json.compensation?.month && json.compensation?.ytd, 'missing compensation blocks');
  const compKeys = ['totalGross','avgGross','totalNet','avgNet'];
  for(const ck of compKeys){
    assert(typeof json.compensation.month[ck] === 'number', `month ${ck} not number`);
    assert(typeof json.compensation.ytd[ck] === 'number', `ytd ${ck} not number`);
  }
  // Basic sanity: turnover percentages within plausible range (0-200%)
  assert(hc.turnoverMonth >= 0 && hc.turnoverMonth <= 200, 'turnoverMonth out of range');
  assert(hc.turnoverYtd >= 0 && hc.turnoverYtd <= 200, 'turnoverYtd out of range');
  // Tenure block
  assert(json.tenure, 'missing tenure block');
  assert(typeof json.tenure.averageDays === 'number', 'tenure.averageDays not number');
  assert(typeof json.tenure.averageMonths === 'number', 'tenure.averageMonths not number');
  assert(typeof json.tenure.activeSample === 'number', 'tenure.activeSample not number');
  assert(json.tenure.averageDays >= 0, 'tenure.averageDays negative');
  assert(json.tenure.averageMonths >= 0, 'tenure.averageMonths negative');
  assert(json.tenure.buckets, 'missing tenure buckets');
  ['<6m','6-12m','1-2y','2-5y','5y+'].forEach(b=>{
    assert(typeof json.tenure.buckets[b] === 'number', `tenure bucket ${b} not number`);
    assert(json.tenure.buckets[b] >= 0, `tenure bucket ${b} negative`);
  });
  // Age block
  assert(json.age, 'missing age block');
  assert(typeof json.age.averageYears === 'number', 'age.averageYears not number');
  assert(typeof json.age.medianYears === 'number', 'age.medianYears not number');
  assert(json.age.averageYears >= 0 && json.age.medianYears >= 0, 'age metrics negative');
  ['<25','25-34','35-44','45-54','55+'].forEach(k=>{
    assert(typeof json.age.buckets[k] === 'number', `age bucket ${k} not number`);
    assert(json.age.buckets[k] >= 0, `age bucket ${k} negative`);
  });
  console.log('Personnel summary OK (extended)');
}

main().catch(e => { console.error(e); process.exit(1); });
