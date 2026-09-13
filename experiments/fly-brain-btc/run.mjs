import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FLY = process.env.FLY_BRAIN_DIR || path.resolve('fly-brain');
const OUT = path.resolve('experiments/fly-brain-btc/out');
fs.mkdirSync(OUT, {recursive:true});

const feeFallback = 0.0005;
const alloc = 0.80;
const warmup = 20;
const evalBars = 240;
const block = 20;

const ymd = d => `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
const jstNow = new Date(Date.now() + 9*3600_000);
const dates = [0,1,2].map(k => { const d = new Date(jstNow); d.setUTCDate(d.getUTCDate()-k); return ymd(d); }).reverse();

async function getJson(url){
  const r = await fetch(url, {headers:{'user-agent':'fly-brain-btc-paper/0.1'}});
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function loadCandles(){
  const all=[];
  for(const date of dates){
    const j=await getJson(`https://api.coin.z.com/public/v1/klines?symbol=BTC&interval=5min&date=${date}`);
    if(j.status===0 && Array.isArray(j.data)) all.push(...j.data);
  }
  return all.map(x=>({
    t:+x.openTime, o:+x.open, h:+x.high, l:+x.low, c:+x.close, v:+x.volume
  })).sort((a,b)=>a.t-b.t).filter((x,i,a)=>!i || x.t!==a[i-1].t);
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

function scenarioFor({retPct,volPct}){
  if(volPct>=0.55) return 'threat';
  if(retPct>=0.22) return 'nearodor';
  if(retPct<=-0.22) return 'onheat';
  return 'default';
}

function runFly(scenario){
  const stdout=execFileSync('node',['scripts/run_fly.mjs','0.6',scenario,'descending','{"flyvis":false,"vision":false}'],{
    cwd:FLY, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:120000, maxBuffer:8*1024*1024
  });
  const lines=stdout.trim().split(/\r?\n/).filter(x=>x.includes('DN fwd'));
  const line=lines.at(-1)||'';
  const m=line.match(/\[([^\]]+)\].*DN fwd\s+([\d.-]+)\s+back\s+([\d.-]+)\s+turn\s+([\d.-]+)\s+v\s+([\d.-]+)\s+GF\s+([\d.-]+)\s+TO\s+([\d.-]+)/);
  if(!m) return {action:'CASH', behavior:'parse-fail', raw:line};
  const behavior=m[1];
  const drive=+m[2], back=+m[3], turn=+m[4], v=+m[5], gf=+m[6], takeoff=+m[7];
  const appetite=Math.max(0,drive)+Math.max(0,v)*40;
  const alarm=Math.max(0,back)+Math.abs(turn)*8+Math.max(0,gf)*60+Math.max(0,takeoff)*60;
  const risky=/escape|back|takeoff/i.test(behavior);
  const action=(!risky && appetite>alarm*1.05)?'BTC':'CASH';
  return {action,behavior,drive,back,turn,v,gf,takeoff,appetite,alarm,raw:line};
}

function markToMarket(p, px){return p.cash+p.btc*px;}
function setAction(p, action, px, fee){
  if(action==='BTC' && p.btc===0){
    const spend=p.cash*alloc; const net=spend*(1-fee); p.cash-=spend; p.btc+=net/px; p.cost+=spend*fee;
  }
  if(action==='CASH' && p.btc>0){
    const gross=p.btc*px; const f=gross*fee; p.cash+=gross-f; p.cost+=f; p.btc=0;
  }
}

const candles=await loadCandles();
if(candles.length<warmup+evalBars) throw new Error(`candles insufficient: ${candles.length}`);
const data=candles.slice(-(warmup+evalBars));
const fee=await loadFee();
const p={cash:1000,btc:0,cost:0};
const decisions=[];

for(let i=warmup;i<data.length;i+=block){
  const hist=data.slice(i-warmup,i);
  const next=data.slice(i,Math.min(i+block,data.length));
  if(!next.length) break;
  const feat=stats(hist);
  const scenario=scenarioFor(feat);
  const fly=runFly(scenario);
  const entry=next[0].o, exit=next.at(-1).c;
  setAction(p,fly.action,entry,fee);
  const eq0=markToMarket(p,entry), eq1=markToMarket(p,exit);
  decisions.push({i, time:new Date(next[0].t).toISOString(), feat, scenario, fly, action:fly.action, entry, exit, equityStart:eq0, equityEnd:eq1});
}

const finalPx=data.at(-1).c;
setAction(p,'CASH',finalPx,fee);
const flyEq=p.cash;
const startPx=data[warmup].o;
const cash=1000;
const holdCash=1000*(1-alloc);
const holdBtc=(1000*alloc*(1-fee))/startPx;
const holdGross=holdCash+holdBtc*finalPx;
const holdCostExit=holdBtc*finalPx*fee;
const holdEq=holdGross-holdCostExit;

const result={
  source:'Lulzx/fly-brain', sourceCommit:'7cd56e16b782a584f26ff3a9f63151c63d4db31b',
  symbol:'BTC', interval:'5min', bars:evalBars, warmupBars:warmup, decisionBlock:block,
  fee, allocation:alloc, range:{from:new Date(data[warmup].t).toISOString(),to:new Date(data.at(-1).t).toISOString()},
  final:{flyBrain:flyEq,cash,buyHold:holdEq}, returnsPct:{flyBrain:(flyEq/1000-1)*100,cash:0,buyHold:(holdEq/1000-1)*100},
  costs:{flyBrain:p.cost}, decisions
};
fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));
const md=[
  '# Fly Brain BTC/JPY PAPER', '',
  `- source: Lulzx/fly-brain @ ${result.sourceCommit.slice(0,8)}`,
  `- range: ${result.range.from} -> ${result.range.to}`,
  `- fee: ${(fee*100).toFixed(3)}% one-way`,
  `- Fly Brain: ¥${flyEq.toFixed(2)} (${result.returnsPct.flyBrain.toFixed(2)}%)`,
  `- Cash: ¥1000.00 (0.00%)`,
  `- BTC Buy & Hold: ¥${holdEq.toFixed(2)} (${result.returnsPct.buyHold.toFixed(2)}%)`,
  `- Fly Brain cost: ¥${p.cost.toFixed(2)}`, '',
  '|time|past return|past vol|stimulus|behavior|decision|equity|',
  '|---|---:|---:|---|---|---|---:|',
  ...decisions.map(d=>`|${d.time}|${d.feat.retPct.toFixed(2)}%|${d.feat.volPct.toFixed(3)}%|${d.scenario}|${d.fly.behavior}|${d.action}|¥${d.equityEnd.toFixed(2)}|`)
].join('\n');
fs.writeFileSync(path.join(OUT,'summary.md'),md);
console.log(md);
