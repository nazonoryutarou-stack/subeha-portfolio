import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FLY = process.env.FLY_BRAIN_DIR || path.resolve('fly-brain');
const OUT = path.resolve('experiments/fly-brain-btc/out');
fs.mkdirSync(OUT, {recursive:true});

const feeFallback = 0.0005;
const alloc = 0.80;
const windowBars = 20;
const calibrationBars = 240;
const evalBars = 240;
const block = 20;
const simSeconds = 0.8;

const ymd = d => `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
const jstNow = new Date(Date.now() + 9*3600_000);
const dates = [0,1,2,3].map(k => { const d = new Date(jstNow); d.setUTCDate(d.getUTCDate()-k); return ymd(d); }).reverse();

async function getJson(url){
  const r = await fetch(url, {headers:{'user-agent':'fly-brain-btc-paper/0.2'}});
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function loadCandles(){
  const all=[];
  for(const date of dates){
    const j=await getJson(`https://api.coin.z.com/public/v1/klines?symbol=BTC&interval=5min&date=${date}`);
    if(j.status===0 && Array.isArray(j.data)) all.push(...j.data);
  }
  return all.map(x=>({t:+x.openTime,o:+x.open,h:+x.high,l:+x.low,c:+x.close,v:+x.volume}))
    .sort((a,b)=>a.t-b.t).filter((x,i,a)=>!i || x.t!==a[i-1].t);
}

async function loadFee(){
  try{
    const j=await getJson('https://api.coin.z.com/public/v1/symbols');
    const s=(j.data||[]).find(x=>x.symbol==='BTC');
    const f=Number(s?.takerFee);
    return Number.isFinite(f) ? f : feeFallback;
  }catch{return feeFallback;}
}

function stats(xs){
  const closes=xs.map(x=>x.c);
  const ret=(closes.at(-1)/closes[0]-1)*100;
  const rs=[];
  for(let i=1;i<closes.length;i++) rs.push(Math.log(closes[i]/closes[i-1]));
  const m=rs.reduce((a,b)=>a+b,0)/(rs.length||1);
  const vol=Math.sqrt(rs.reduce((a,b)=>a+(b-m)**2,0)/(rs.length||1))*100;
  return {retPct:ret, volPct:vol};
}
function quantile(xs,q){
  const a=[...xs].sort((x,y)=>x-y); if(!a.length) return 0;
  const p=(a.length-1)*q, lo=Math.floor(p), hi=Math.ceil(p), f=p-lo;
  return a[lo]*(1-f)+a[hi]*f;
}

function runFly(scenario){
  const stdout=execFileSync('node',['scripts/run_fly.mjs',String(simSeconds),scenario,'descending','{"flyvis":false,"vision":false}'],{
    cwd:FLY, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:120000, maxBuffer:8*1024*1024
  });
  const lines=stdout.trim().split(/\r?\n/).filter(x=>x.includes('DN fwd'));
  const line=lines.at(-1)||'';
  const m=line.match(/\[([^\]]+)\].*DN fwd\s+([\d.-]+)\s+back\s+([\d.-]+)\s+turn\s+([\d.-]+)\s+v\s+([\d.-]+)\s+GF\s+([\d.-]+)\s+TO\s+([\d.-]+)/);
  if(!m) return {action:'CASH', behavior:'parse-fail', raw:line};
  const behavior=m[1];
  const drive=+m[2], back=+m[3], turn=+m[4], v=+m[5], gf=+m[6], takeoff=+m[7];
  const approach=Math.max(0,drive)+Math.max(0,v)*40;
  const escape=Math.max(0,back)+Math.abs(turn)*8+Math.max(0,gf)*60+Math.max(0,takeoff)*60;
  const risky=/escape|back|takeoff/i.test(behavior);
  const action=(!risky && approach>escape*1.05)?'BTC':'CASH';
  return {action,behavior,drive,back,turn,v,gf,takeoff,approach,escape,raw:line};
}

function scenarioFor(feat,cal){
  if(feat.volPct>=cal.volHigh) return 'threat';
  if(feat.retPct>=cal.retHigh) return 'nearodor';
  if(feat.retPct<=cal.retLow) return 'onheat';
  return 'default';
}
function heuristicAction(scenario){ return scenario==='nearodor' ? 'BTC' : 'CASH'; }
function markToMarket(p,px){return p.cash+p.btc*px;}
function setAction(p,action,px,fee){
  if(action==='BTC' && p.btc===0){ const spend=p.cash*alloc, net=spend*(1-fee); p.cash-=spend; p.btc+=net/px; p.cost+=spend*fee; }
  if(action==='CASH' && p.btc>0){ const gross=p.btc*px, f=gross*fee; p.cash+=gross-f; p.cost+=f; p.btc=0; }
}

const candles=await loadCandles();
const need=windowBars+calibrationBars+evalBars;
if(candles.length<need) throw new Error(`candles insufficient: ${candles.length} < ${need}`);
const data=candles.slice(-need);
const fee=await loadFee();

// Calibrate only on the period BEFORE the evaluated 240 bars. No future bars enter thresholds.
const calEnd=windowBars+calibrationBars;
const calFeatures=[];
for(let i=windowBars;i<calEnd;i+=block) calFeatures.push(stats(data.slice(i-windowBars,i)));
const cal={
  retLow:quantile(calFeatures.map(x=>x.retPct),0.30),
  retHigh:quantile(calFeatures.map(x=>x.retPct),0.70),
  volHigh:quantile(calFeatures.map(x=>x.volPct),0.70)
};

// A fixed scenario probe proves whether the connectome produces distinct motor states at all.
const probes={};
for(const s of ['default','nearodor','onheat','threat','onfood']) probes[s]=runFly(s);

const flyP={cash:1000,btc:0,cost:0};
const ruleP={cash:1000,btc:0,cost:0};
const decisions=[];
for(let i=calEnd;i<data.length;i+=block){
  const hist=data.slice(i-windowBars,i);
  const next=data.slice(i,Math.min(i+block,data.length));
  if(!next.length) break;
  const feat=stats(hist);
  const scenario=scenarioFor(feat,cal);
  const fly=runFly(scenario);
  const rule=heuristicAction(scenario);
  const entry=next[0].o, exit=next.at(-1).c;
  setAction(flyP,fly.action,entry,fee);
  setAction(ruleP,rule,entry,fee);
  decisions.push({
    i,time:new Date(next[0].t).toISOString(),feat,scenario,fly,rule,
    action:fly.action,entry,exit,
    flyEquity:markToMarket(flyP,exit), ruleEquity:markToMarket(ruleP,exit)
  });
}

const finalPx=data.at(-1).c;
setAction(flyP,'CASH',finalPx,fee);
setAction(ruleP,'CASH',finalPx,fee);
const flyEq=flyP.cash, ruleEq=ruleP.cash, cash=1000;
const startPx=data[calEnd].o;
const holdCash=1000*(1-alloc), holdBtc=(1000*alloc*(1-fee))/startPx;
const holdGross=holdCash+holdBtc*finalPx, holdEq=holdGross-holdBtc*finalPx*fee;
const counts={}; for(const d of decisions) counts[d.scenario]=(counts[d.scenario]||0)+1;

const result={
  experiment:'fly-brain-btc-v0.2', source:'Lulzx/fly-brain', sourceCommit:'7cd56e16b782a584f26ff3a9f63151c63d4db31b',
  symbol:'BTC',interval:'5min',evalBars,calibrationBars,windowBars,decisionBlock:block,simSeconds,fee,allocation:alloc,
  calibration:cal,probes,scenarioCounts:counts,
  range:{from:new Date(data[calEnd].t).toISOString(),to:new Date(data.at(-1).t).toISOString()},
  final:{flyBrain:flyEq,stimulusRule:ruleEq,cash,buyHold:holdEq},
  returnsPct:{flyBrain:(flyEq/1000-1)*100,stimulusRule:(ruleEq/1000-1)*100,cash:0,buyHold:(holdEq/1000-1)*100},
  costs:{flyBrain:flyP.cost,stimulusRule:ruleP.cost},decisions
};
fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));
const md=[
  '# Fly Brain BTC/JPY PAPER v0.2','',
  `- source: Lulzx/fly-brain @ ${result.sourceCommit.slice(0,8)}`,
  `- range: ${result.range.from} -> ${result.range.to}`,
  `- calibration thresholds: retLow ${cal.retLow.toFixed(3)}% / retHigh ${cal.retHigh.toFixed(3)}% / volHigh ${cal.volHigh.toFixed(3)}%`,
  `- stimuli: ${Object.entries(counts).map(([k,v])=>`${k} ${v}`).join(' / ')}`,
  `- fee: ${(fee*100).toFixed(3)}% one-way`,
  `- Fly Brain: ¥${flyEq.toFixed(2)} (${result.returnsPct.flyBrain.toFixed(2)}%) / cost ¥${flyP.cost.toFixed(2)}`,
  `- Stimulus rule: ¥${ruleEq.toFixed(2)} (${result.returnsPct.stimulusRule.toFixed(2)}%) / cost ¥${ruleP.cost.toFixed(2)}`,
  `- Cash: ¥1000.00 (0.00%)`,
  `- BTC Buy & Hold: ¥${holdEq.toFixed(2)} (${result.returnsPct.buyHold.toFixed(2)}%)`,'',
  '## Scenario probe','',
  ...Object.entries(probes).map(([k,v])=>`- ${k}: ${v.behavior} -> ${v.action} (approach ${Number(v.approach||0).toFixed(2)} / escape ${Number(v.escape||0).toFixed(2)})`),
  '', '|time|past return|past vol|stimulus|fly behavior|fly|rule|fly equity|',
  '|---|---:|---:|---|---|---|---|---:|',
  ...decisions.map(d=>`|${d.time}|${d.feat.retPct.toFixed(2)}%|${d.feat.volPct.toFixed(3)}%|${d.scenario}|${d.fly.behavior}|${d.action}|${d.rule}|¥${d.flyEquity.toFixed(2)}|`)
].join('\n');
fs.writeFileSync(path.join(OUT,'summary.md'),md);
console.log(md);
