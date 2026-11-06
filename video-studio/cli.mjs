#!/usr/bin/env node
// No third-party packages. Structural checks do not replace perceptual/video review.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const hub = dirname(fileURLToPath(import.meta.url));
const root = resolve(hub, '..');
const catalog = JSON.parse(readFileSync(join(hub, 'catalog.json'), 'utf8'));
const command = process.argv[2] || 'help';
const args = process.argv.slice(3);
const profiles = {landscape:[1280,720], short:[1080,1920]};

function die(s) { console.error('ERROR: '+s); process.exitCode=1; }
function usage() {
  console.log('video-studio: list | check | doctor | new <slug> [landscape|short] | validate <job.json> | qc <mp4> [landscape|short]');
}
function getProbe(file) {
  const r = spawnSync('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',file], {encoding:'utf8'});
  if (r.error || r.status !== 0) throw new Error('ffprobe failed: '+(r.stderr || r.error?.message || 'unknown'));
  return JSON.parse(r.stdout);
}
function check() {
  let fail=0, local=0, external=0;
  const names=new Set();
  for(const skill of catalog.skills) {
    if(names.has(skill.name)) { console.error('duplicate skill: '+skill.name); fail++; }
    names.add(skill.name);
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skill.name) || skill.name.length>64) { console.error('invalid name: '+skill.name); fail++; }
    const file=join(root,skill.path);
    if(!existsSync(file)) {console.error('missing '+skill.path);fail++;continue;}
    const text=readFileSync(file,'utf8');
    if(!text.startsWith('---\n') || !text.includes('\nname: '+skill.name+'\n') || !/^description: .+$/m.test(text)) {
      console.error('invalid frontmatter: '+skill.path);fail++;
    }
    for(const src of skill.sources) {
      if(src.repo===catalog.public_repository && src.branch==='main') {
        local++;
        if(!existsSync(join(root,src.path))) {console.error('missing main source: '+src.path);fail++;}
      } else external++;
    }
  }
  console.log('skills='+catalog.skills.length+' local_refs='+local+' cross_branch_or_private_refs='+external+' failures='+fail);
  if(fail) process.exitCode=1;
}
function doctor() {
  for(const c of ['node','ffmpeg','ffprobe','git']) {
    const r=spawnSync(c,['-version'],{encoding:'utf8'});
    console.log(c+': '+(r.error?'NOT INSTALLED':'available'));
  }
  check();
}
function newJob() {
  const slug=args[0], profile=args[1] || 'landscape';
  if(!slug || !/^[a-zA-Z0-9][a-zA-Z0-9-_]{0,60}$/.test(slug)) return die('slug must be ASCII letters/digits/dash/underscore');
  if(!profiles[profile]) return die('profile must be landscape or short');
  const dest=join(hub,'jobs',slug,'job.json');
  if(existsSync(dest)) return die('will not overwrite existing '+dest);
  mkdirSync(dirname(dest),{recursive:true});
  const job = {schema:'subeha-video-job-v1',name:slug,status:'draft',profile,source_audio:null,timed_transcript:null,clean_transcript:null,speaker_turns:null,privacy_reviewed:false,rights_reviewed:false,notes:'Add same-source audio, timed+clean, speaker labels before production.'};
  writeFileSync(dest,JSON.stringify(job,null,2)+'\n','utf8');
  console.log('draft created: '+dest);
}
function validate() {
  if(!args[0]) return die('provide job.json path');
  let job; try {job=JSON.parse(readFileSync(resolve(args[0]),'utf8'));} catch(e){return die(e.message);}
  const problems=[];
  if(job.schema!=='subeha-video-job-v1') problems.push('schema mismatch');
  if(!profiles[job.profile]) problems.push('invalid profile');
  for(const f of ['source_audio','timed_transcript','clean_transcript','speaker_turns']) {
    if(typeof job[f]!=='string' || !job[f].trim()) problems.push('missing '+f);
    else if(!existsSync(resolve(dirname(resolve(args[0])),job[f]))) problems.push('not found '+f);
  }
  if(job.privacy_reviewed!==true) problems.push('privacy_reviewed not true');
  if(job.rights_reviewed!==true) problems.push('rights_reviewed not true');
  if(problems.length) return die(problems.join('; '));
  console.log('job manifest validated (not a render or sync test): '+resolve(args[0]));
}
function qc() {
  const file=args[0], profile=args[1];
  if(!file) return die('provide MP4 file');
  if(profile && !profiles[profile]) return die('profile must be landscape or short');
  if(!existsSync(file)) return die('file not found: '+file);
  try {
    const info=getProbe(file);
    const videos=info.streams.filter(x=>x.codec_type==='video');
    const audios=info.streams.filter(x=>x.codec_type==='audio');
    const errs=[], warns=[];
    if(videos.length!==1) errs.push('expected exactly one video stream');
    if(audios.length!==1) errs.push('expected exactly one audio stream');
    const v=videos[0],a=audios[0];
    if(v && v.codec_name!=='h264') errs.push('video codec must be h264');
    if(a && a.codec_name!=='aac') errs.push('audio codec must be aac');
    const duration=Number(info.format?.duration);
    if(!Number.isFinite(duration)||duration<=0) errs.push('invalid duration');
    if(v && profile && (v.width!==profiles[profile][0] || v.height!==profiles[profile][1])) errs.push('profile dimensions mismatch');
    if(v && (!v.width||!v.height)) errs.push('invalid resolution');
    const vd=Number(v?.duration),ad=Number(a?.duration);
    if(Number.isFinite(vd) && Number.isFinite(ad) && Math.abs(vd-ad)>0.3) errs.push('A/V duration drift >300ms');
    if(v && !v.avg_frame_rate) warns.push('fps not reported');
    console.log(JSON.stringify({file:resolve(file),profile:profile||null,duration_s:duration,video:v?{codec:v.codec_name,width:v.width,height:v.height,fps:v.avg_frame_rate,duration:v.duration}:null,audio:a?{codec:a.codec_name,duration:a.duration,sample_rate:a.sample_rate}:null,structural_pass:errs.length===0,errors:errs,warnings:warns,visual_qc:'REQUIRED: inspect start, speech, middle, fast speech/end, subtitle, privacy and VRM pose'},null,2));
    if(errs.length) process.exitCode=1;
  } catch(e){die(e.message);}
}
switch(command) {
 case 'help':case '--help':usage();break;
 case 'list':for(const s of catalog.skills) console.log(s.name+'\t'+s.phase+'\t'+s.status);break;
 case 'check':check();break;
 case 'doctor':doctor();break;
 case 'new':newJob();break;
 case 'validate':validate();break;
 case 'qc':qc();break;
 default:usage();die('unknown command '+command);
}
