import * as THREE from '../arcade/vendor/three.module.min.js';
import {createControls} from '../arcade/controls.js';
import {buildWorld,canOccupy,movePlayer,roomAt,EYE} from './world-v2.js';

export async function startArchitecture({Renderer=THREE.WebGLRenderer,entryURL=location.href,reviewLabel=''}={}){
  const $=id=>document.getElementById(id),canvas=$('c');
  const params=new URLSearchParams(location.search),qa=params.has('qa');
  const touch=matchMedia('(pointer:coarse)').matches||params.has('touch');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const renderer=new Renderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=false;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x151812);
  scene.fog=new THREE.FogExp2(0x151812,.032);
  scene.add(new THREE.HemisphereLight(0xb7b89c,0x302a22,1.05));
  const windowLight=new THREE.DirectionalLight(0xcbd3b6,1.15);windowLight.position.set(-4,7,9);scene.add(windowLight);
  const receptionLight=new THREE.PointLight(0xe1b879,4.8,7.5,2);receptionLight.position.set(-3.6,2.3,6.4);scene.add(receptionLight);
  const inspectionLight=new THREE.PointLight(0xbac9ad,3.4,6.2,2);inspectionLight.position.set(3.4,2.35,-1);scene.add(inspectionLight);
  const rearLight=new THREE.PointLight(0xc77c54,2,4,2);rearLight.position.set(-3.8,1.9,-5);scene.add(rearLight);

  const camera=new THREE.PerspectiveCamera(70,1,.06,35);
  const world=buildWorld(scene);
  const player={x:0,z:9.85,yaw:0,pitch:-.02};
  let running=false,paused=false,contextLost=false,last=0,elapsed=0,scan=0,uiClock=0,saved=0;
  let quality='auto',dpr=Math.min(devicePixelRatio||1,touch?1.15:1.45),slow=0,fast=0,frames=[],active=null,noticeTimer;
  const direction=new THREE.Vector3(),look=new THREE.Vector3();
  const ray=new THREE.Raycaster();ray.near=.03;ray.far=2.45;

  function resize(){renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=innerHeight>innerWidth?83:68;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();

  function notice(text){clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,3800);}
  function save(){try{sessionStorage.setItem('astra-architecture-001-pose',JSON.stringify(player));}catch{}}
  function restore(){try{const p=JSON.parse(sessionStorage.getItem('astra-architecture-001-pose'));if(p&&canOccupy(p.x,p.z)&&Number.isFinite(p.yaw)&&Number.isFinite(p.pitch)){Object.assign(player,p);player.pitch=THREE.MathUtils.clamp(player.pitch,-.82,.82);}}catch{}}
  restore();

  function move(f,s,amount){if(!running||paused||contextLost)return;const dx=(Math.sin(player.yaw)*f+Math.cos(player.yaw)*s)*amount;const dz=(-Math.cos(player.yaw)*f+Math.sin(player.yaw)*s)*amount;movePlayer(player,dx,dz);}
  function turn(x,y){player.yaw+=x;player.pitch=THREE.MathUtils.clamp(player.pitch+y,-.82,.82);}
  function visibleHit(origin,dir){ray.set(origin,dir);return ray.intersectObjects(scene.children,true).find(h=>h.object.visible&&(!h.object.material?.transparent||h.object.material.opacity>.55));}
  function findTarget(point){
    if(point){ray.setFromCamera(new THREE.Vector2(point.x/innerWidth*2-1,1-point.y/innerHeight*2),camera);const hit=visibleHit(ray.ray.origin,ray.ray.direction);return hit?world.targets.find(t=>t.mesh===hit.object):null;}
    camera.getWorldDirection(direction);let best=null,bestScore=.93;
    for(const t of world.targets){const v=t.position.clone().sub(camera.position),distance=v.length();if(distance<.08||distance>2.45)continue;v.normalize();const score=direction.dot(v);if(score<=bestScore)continue;const hit=visibleHit(camera.position,v);if(hit&&hit.object!==t.mesh&&hit.distance<distance-.07)continue;best=t;bestScore=score;}
    return best;
  }
  function inspect(point){if(!running||paused)return;const target=point?findTarget(point):findTarget();if(!target)return;if(target.text)notice(target.text);if(target.href){save();controls.reset();document.exitPointerLock?.();setTimeout(()=>location.assign(new URL(target.href,entryURL).href),120);}}

  const controls=createControls(canvas,{step:move,turn,inspect,changed:()=>{}});
  function showControls(){const buttons=$('button-mode').checked;$('touch-controls').hidden=!running||paused||(!touch&&!buttons);$('joystick').hidden=buttons;$('dpad').hidden=!buttons;$('look-hint').hidden=!touch;}
  function help(open){paused=open;$('instructions').hidden=!open;$('help').setAttribute('aria-expanded',String(open));controls.enabled=running&&!paused;controls.reset();showControls();if(open){document.exitPointerLock?.();$('close-help').focus();}else canvas.focus({preventScroll:true});}
  $('help').onclick=()=>help(!paused);$('close-help').onclick=()=>help(false);addEventListener('keydown',e=>{if(e.code==='Escape'&&paused)help(false);});
  $('button-mode').onchange=()=>{controls.reset();showControls();};
  $('calm').checked=reduced.matches;reduced.addEventListener('change',e=>$('calm').checked=e.matches);
  $('quality').onchange=()=>{quality=$('quality').value;dpr=quality==='low'?.75:Math.min(devicePixelRatio||1,quality==='high'?1.65:touch?1.15:1.45);slow=fast=0;resize();};
  $('reset').onclick=()=>{Object.assign(player,{x:0,z:9.85,yaw:0,pitch:-.02});save();help(false);notice('入口へ戻った。');};
  $('lock-mouse').hidden=touch;$('lock-mouse').onclick=async()=>{help(false);try{await canvas.requestPointerLock();}catch{notice('画面をドラッグして見回せます。');}};
  $('interact').onclick=()=>inspect();

  function updateCamera(){camera.position.set(player.x,EYE,player.z);look.set(Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch)).add(camera.position);camera.lookAt(look);camera.updateMatrixWorld();}
  function refreshUI(fps,p95){const room=roomAt(player.x,player.z);$('location').textContent=room?.name||'廊下';if(qa){$('diagnostic').hidden=false;$('diagnostic').textContent=`${reviewLabel?reviewLabel+'\n':''}${innerWidth}×${innerHeight} / ${touch?'touch UI':'PC'} / ${Math.round(fps)} fps / p95 ${Math.round(p95)} ms\n位置 ${player.x.toFixed(2)}, ${player.z.toFixed(2)} / 方位 ${(player.yaw*180/Math.PI).toFixed(0)} / 仰角 ${(player.pitch*180/Math.PI).toFixed(0)}\n${room?.name||'廊下'} / 対象 ${active?.id||'—'}\n描画 ${renderer.info.render.calls} / 三角形 ${renderer.info.render.triangles} / DPR ${dpr.toFixed(2)}`;}}

  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;controls.enabled=false;controls.reset();notice('表示が中断しました。復帰を待っています。');});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;controls.enabled=running&&!paused;controls.reset();last=0;notice('事務所へ戻りました。');});
  addEventListener('visibilitychange',()=>{last=0;frames=[];if(document.hidden)save();});addEventListener('pagehide',save);addEventListener('pageshow',()=>{controls.reset();last=0;resize();});

  function animate(t){
    requestAnimationFrame(animate);if(document.hidden||contextLost)return;const raw=last?(t-last)/1000:1/60,dt=Math.min(raw,.05);last=t;elapsed+=dt;
    if(running&&!paused){const {f,s}=controls.read(dt);if(f||s)move(f,s,dt*1.52);}updateCamera();
    const calm=$('calm').checked,pulse=calm?1:(elapsed%13.7>12.9&&elapsed%13.7<13.08?.35:1);for(const m of world.flickerMaterials)m.emissiveIntensity=1.8*pulse;
    if(running&&!paused){scan+=dt;if(scan>.1){scan=0;active=findTarget();$('interact').hidden=!active;if(active)$('target-label').textContent=active.label;}}else{$('interact').hidden=true;active=null;}
    renderer.render(scene,camera);
    if(running&&!paused){frames.push(raw*1000);uiClock+=raw;saved+=dt;if(uiClock>=1.5){const sorted=[...frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||16.7,fps=frames.length*1000/Math.max(1,frames.reduce((a,b)=>a+b,0));refreshUI(fps,p95);if(quality==='auto'){slow=fps<32?slow+1:0;fast=fps>54?fast+1:0;if(slow>=2&&dpr>.7){dpr=Math.max(.7,dpr-.15);resize();slow=0;}if(fast>=12&&dpr<Math.min(devicePixelRatio||1,touch?1.15:1.45)){dpr=Math.min(dpr+.1,devicePixelRatio||1,touch?1.15:1.45);resize();fast=0;}}frames=[];uiClock=0;}if(saved>3){save();saved=0;}}
  }

  updateCamera();renderer.render(scene,camera);requestAnimationFrame(animate);$('enter').disabled=false;$('enter').textContent='入る';
  $('enter').onclick=()=>{running=true;controls.enabled=true;$('gate').hidden=true;document.querySelector('.top').hidden=false;showControls();canvas.focus({preventScroll:true});refreshUI(0,0);notice('祭祀技師事務所。');};
}
