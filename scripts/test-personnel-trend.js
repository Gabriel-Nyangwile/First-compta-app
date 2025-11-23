#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const res = await fetch('http://localhost:3000/api/personnel/trend?months=6');
  assert(res.ok, 'personnel trend endpoint failed');
  const json = await res.json();
  assert(Array.isArray(json.months), 'months not array');
  assert(json.months.length <= 6, 'expected max 6 months');
  // Order ascending by year/month
  for(let i=1;i<json.months.length;i++){
    const prev = json.months[i-1];
    const cur = json.months[i];
    const prevKey = prev.year*100 + prev.month;
    const curKey = cur.year*100 + cur.month;
    assert(curKey >= prevKey, 'months not sorted asc');
  }
  for(const m of json.months){
    ['activeStart','activeEnd','avgHeadcount','hires','exits','hiresRatePct','exitTurnoverPct'].forEach(k => {
      assert(typeof m[k] === 'number', `${k} not number`);
      assert(m[k] >= 0, `${k} negative`);
    });
    assert(m.avgHeadcount >= m.activeStart/2 && m.avgHeadcount <= (m.activeStart+m.activeEnd)/2 + 1, 'avgHeadcount plausibility');
    assert(m.hiresRatePct <= 500 && m.exitTurnoverPct <= 500, 'rates out of range');
  }
  console.log('Personnel trend OK');
}

main().catch(e => { console.error(e); process.exit(1); });
