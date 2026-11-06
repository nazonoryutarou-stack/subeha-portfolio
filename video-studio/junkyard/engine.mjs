#!/usr/bin/env node
// Low-resolution FFmpeg material salvage. Intentionally no shell interpolation.
import {readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve, dirname, join, extname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url));
const recipes=JSON.parse(readFileSync(join(here,'recipes.json'),'utf8')).recipes;
const cmd=process.argv[2]||'help', id=process.argv[3];
const byId=new Map(recipes.map(r=>[r.id,r]));
function fail(msg){console.error('ERROR: '+msg);process.exitCode=1;}
function opts(argv) {
 const out={};
 for(let i=0;i<argv.length;i++){
   if(!argv[i].startsWith('--'))throw Error('unexpected argument '+argv[i]);
   const k=argv[i].slice(2);
   if(['force','dry-run'].includes(k)){out[k]=true;continue;}
   if(i+1>=argv.length || argv[i+1].startsWith('--'))throw Error('missing value for --'+k);
   out[k]=argv[++i];
 }
 return out;
}
function safeParams(o) {
 const size=o.size||'640x360',duration=Number(o.duration||3),fps=Number(o.fps||24);
 if(!/^\d{2,4}x\d{2,4}$/.test(size))throw Error('size must be WIDTHxHEIGHT');
 const [w,h]=size.split('x').map(Number);
 if(w<64||h<64||w>3840||h>2160||w%2||h%2)throw Error('even dimensions 64..3840x2160 required');
 if(!Number.isFinite(duration)||duration<=0||duration>60)throw Error('duration must be >0 and <=60s');
 if(!Number.isInteger(fps)||fps<1||fps>60)throw Error('fps must be integer 1..60');
 return {w,h,duration,fps};
}
function graph(r,p) {
 return r.graph.replaceAll('{W}',String(p.w)).replaceAll('{H}',String(p.h)).replaceAll('{FPS}',String(p.fps));
}
function build(r,o,test) {
 const p=safeParams(test?{size:'320x180',duration:0.5,fps:12}:o);
 const out=test?o.out:o.out;
 if(!out)throw Error('--out required');
 if(extname(out).toLowerCase()!=='.mp4')throw Error('output must end in .mp4');
 const outfile=resolve(out);
 if(!test && existsSync(outfile) && !o.force)throw Error('output exists; use --force to replace');
 const args=['-hide_banner','-loglevel',test?'error':'warning',o.force||test?'-y':'-n'];
 let filter=graph(r,p);
 if(r.kind==='source') {
   args.push('-f','lavfi','-i',filter,'-t',String(p.duration));
   args.push('-vf',`scale=${p.w}:${p.h},fps=${p.fps}`,'-an');
 } else {
   if(!test && !o.input)throw Error('--input required for effect recipe');
   if(test)args.push('-f','lavfi','-i','testsrc2=size=320x180:rate=12');
   else args.push('-i',resolve(o.input));
   args.push('-t',String(p.duration),'-map','0:v:0');
   if(!test)args.push('-map','0:a?');
   // Explicit letterboxing avoids stretching arbitrary source footage.
   filter+=`,scale=${p.w}:${p.h}:force_original_aspect_ratio=decrease,pad=${p.w}:${p.h}:(ow-iw)/2:(oh-ih)/2,fps=${p.fps}`;
   args.push('-vf',filter);
   if(test)args.push('-an');
   else args.push('-c:a','aac','-b:a','128k','-shortest');
 }
 args.push('-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',outfile);
 return {args,outfile,params:p};
}
function probe(file) {
 const r=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:12000});
 if(r.error||r.status!==0)throw Error('ffprobe error: '+(r.stderr||r.error?.message||'unknown'));
 const data=JSON.parse(r.stdout); if(!data.streams?.some(s=>s.codec_type==='video'))throw Error('no video stream');
 const d=Number(data.format?.duration);
 if(!Number.isFinite(d)||d<=0)throw Error('invalid media duration');
 return {duration_s:d,video:data.streams.find(s=>s.codec_type==='video')?.codec_name};
}
function run(r,o,test=false) {
 const a=build(r,o,test);
 if(o['dry-run']){console.log(JSON.stringify({id:r.id,argv:['ffmpeg',...a.args],kind:r.kind},null,2));return;}
 mkdirSync(dirname(a.outfile),{recursive:true});
 const t=Date.now();
 const res=spawnSync('ffmpeg',a.args,{encoding:'utf8',timeout:test?15000:120000,maxBuffer:1024*1024});
 if(res.error||res.status!==0)throw Error(r.id+': '+(res.stderr||res.error?.message||'ffmpeg failed').slice(-1100));
 const info=probe(a.outfile);
 console.log(JSON.stringify({recipe:r.id,output:a.outfile,elapsed_ms:Date.now()-t,...info,visual_qc:'NOT CHECKED'}));
}
function help(){
 console.log('JUNKYARD: list [category] | inspect <id> | render <id> --out file.mp4 [--input input.mp4] [--size 640x360] [--duration 3] [--fps 24] [--dry-run] [--force] | selftest | doctor');
}
switch(cmd) {
case 'list':
 for(const r of recipes.filter(r=>!id||r.kind===id||r.id.includes(id)))console.log(r.id+'\t'+r.kind+'\t'+r.title);
 break;
case 'inspect':
 if(!byId.has(id))fail('unknown recipe');else console.log(JSON.stringify(byId.get(id),null,2));
 break;
case 'render':
 try{if(!byId.has(id))throw Error('unknown recipe');run(byId.get(id),opts(process.argv.slice(4)));}catch(e){fail(e.message);}
 break;
case 'selftest':{
 const dir=mkdtempSync(join(tmpdir(),'subeha-junkyard-'));
 let passed=0,failed=0;
 try{
   for(const r of recipes){
     try{run(r,{out:join(dir,r.id+'.mp4')},true);passed++;}
     catch(e){console.error('FAIL',r.id,e.message);failed++;}
   }
 }finally{rmSync(dir,{recursive:true,force:true});}
 console.log('TOTAL recipes='+recipes.length+' pass='+passed+' fail='+failed);
 if(failed)process.exitCode=1;
 break;
}
case 'doctor':
 for(const exe of ['node','ffmpeg','ffprobe']){
   const r=spawnSync(exe,['-version'],{encoding:'utf8'});
   console.log(exe+': '+(r.error?'missing':'available'));
 }
 console.log('recipes='+recipes.length);break;
case 'help':case '--help':help();break;
default:help();fail('unknown command');
}
