import * as THREE from './vendor/three.module.min.js';
import {buildWorld,batchStatics,canOccupy,movePlayer,EYE} from './world.js';
import {textureCount} from './surfaces.js';
import {createControls} from './controls.js';
import {createSound} from './sound.js';

export async function startArcade({Renderer=THREE.WebGLRenderer,entryURL=location.href,reviewLabel=''}={}){
  const $=id=>document.getElementById(id),canvas=$('c');
  const params=new URLSearchParams(location.search),qa=params.has('qa');
  const touch=matchMedia('(pointer:coarse)').matches||params.has('touch');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const renderer=new Renderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x59634f);scene.fog=new THREE.Fog(0x59634f,12,44);
  scene.add(new THREE.HemisphereLight(0xbdc5a3,0x66513c,1.30));
  const daylight=new THREE.DirectionalLight(0xe8dfb5,1.30);daylight.position.set(-1,6,12);scene.add(daylight);
  // Two local lights total, regardless of the number of shop lamps. No shadow passes.
  const warm=new THREE.PointLight(0xe2c18b,5.5,8,2),fill=new THREE.PointLight(0xcddcba,3.0,6,2);scene.add(warm,fill);
  const camera=new THREE.PerspectiveCamera(72,1,.06,52);
  const world=buildWorld(scene);batchStatics(scene);
  const player={x:0,z:23.2,yaw:0,pitch:-.025};
  let quality='auto',dpr=Math.min(devicePixelRatio||1,touch?1.2:1.5),running=false,paused=false,contextLost=false;
  let active=null,last=0,elapsed=0,scan=0,uiClock=0,saved=0,noticeTimer,slow=0,fast=0,frames=[];
  const visited=new Set(),sound=createSound(),look=new THREE.Vector3(),direction=new THREE.Vector3();
  const ray=new THREE.Raycaster();ray.near=.03;ray.far=2.65;
  function resize(){
    const width=innerWidth,height=innerHeight;renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
    camera.aspect=width/height;
    // Portrait maintains useful horizontal sight without a fisheye vertical angle.
    camera.fov=height>width?85:70;camera.updateProjectionMatrix();
  }
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();
  function notice(text){clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,3600);}
  function save(){try{sessionStorage.setItem('bukiya-arcade-pose-v2',JSON.stringify(player));}catch{}}
  function restore(){try{const p=JSON.parse(sessionStorage.getItem('bukiya-arcade-pose-v2'));if(p&&canOccupy(p.x,p.z,world)&&Number.isFinite(p.yaw)&&Number.isFinite(p.pitch)){Object.assign(player,p);player.pitch=THREE.MathUtils.clamp(player.pitch,-.85,.85);}}catch{}}
  restore();
  function move(f,s,amount){
    if(!running||paused||contextLost)return;movePlayer(player,(Math.sin(player.yaw)*f+Math.cos(player.yaw)*s)*amount,(-Math.cos(player.yaw)*f+Math.sin(player.yaw)*s)*amount,world);
    document.body.classList.add('walked');
  }
  function turn(x,y){player.yaw+=x;player.pitch=THREE.MathUtils.clamp(player.pitch+y,-.85,.85);}
  function visibleHit(origin,dir){
    ray.set(origin,dir);
    return ray.intersectObjects(scene.children,true).find(h=>h.object.visible&&(!h.object.material.transparent||h.object.material.opacity>.55));
  }
  function findTarget(point){
    if(point){ray.setFromCamera(new THREE.Vector2(point.x/innerWidth*2-1,1-point.y/innerHeight*2),camera);const hit=visibleHit(ray.ray.origin,ray.ray.direction);return hit?world.targets.find(t=>t.mesh===hit.object):null;}
    camera.getWorldDirection(direction);let best=null,bestScore=0;
    for(const t of world.targets){
      const dir=t.position.clone().sub(camera.position),distance=dir.length();if(distance>2.65||distance<.1)continue;
      dir.normalize();const score=direction.dot(dir);if(score<.95||score<=bestScore)continue;
      const hit=visibleHit(camera.position,dir);if(hit&&hit.object!==t.mesh&&hit.distance<distance-.08)continue;
      best=t;bestScore=score;
    }return best;
  }
  function inspect(point){
    if(!running||paused)return;
    const target=point?findTarget(point):findTarget();if(!target)return;
    target.onUse?.();if(target.text)notice(target.text);
    if(target.href){save();controls.reset();sound.suspend();document.exitPointerLock?.();location.assign(new URL(target.href,entryURL).href);}
  }
  const controls=createControls(canvas,{step:move,turn,inspect,changed:()=>document.body.classList.add('walked')});
  function showControls(){
    const buttons=$('button-mode').checked;$('touch-controls').hidden=!running||paused||(!touch&&!buttons);
    $('joystick').hidden=buttons;$('dpad').hidden=!buttons;$('look-hint').hidden=!touch;
  }
  function help(open){
    paused=open;$('instructions').hidden=!open;$('help').setAttribute('aria-expanded',String(open));controls.enabled=running&&!paused;controls.reset();showControls();
    if(open){document.exitPointerLock?.();$('close-help').focus();}else canvas.focus({preventScroll:true});
  }
  $('help').onclick=()=>help(!paused);$('close-help').onclick=()=>help(false);
  addEventListener('keydown',e=>{if(e.code==='Escape'&&paused)help(false);});
  $('button-mode').onchange=()=>{controls.reset();showControls();};
  $('calm').checked=reduced.matches;reduced.addEventListener('change',e=>$('calm').checked=e.matches);
  $('quality').onchange=()=>{quality=$('quality').value;dpr=quality==='low'?.8:Math.min(devicePixelRatio||1,quality==='high'?1.75:touch?1.2:1.5);slow=fast=0;resize();};
  $('reset').onclick=()=>{Object.assign(player,{x:0,z:23.2,yaw:0,pitch:-.025});save();help(false);notice('入口。');};
  $('lock-mouse').hidden=touch;
  $('lock-mouse').onclick=async()=>{help(false);try{await canvas.requestPointerLock();}catch{notice('画面をドラッグして見回せます。');}};
  $('sound').onclick=async()=>{try{const on=await sound.toggle();$('sound').textContent=on?'音 入':'音 切';$('sound').setAttribute('aria-pressed',String(on));}catch{notice('このブラウザでは音を再生できません。');}};
  $('interact').onclick=()=>inspect();
  if(touch){$('entry-help').textContent='左下で歩く。右側をなぞって見回す。';$('interact').querySelector('small').textContent='調べる';}
  function updateCamera(){camera.position.set(player.x,EYE,player.z);look.set(Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch)).add(camera.position);camera.lookAt(look);camera.updateMatrixWorld();}
  function roomAt(){return world.rooms.find(r=>r.name&&Math.abs(player.x)>2.18&&Math.sign(player.x)===r.side&&Math.abs(player.z-r.z)<r.w/2);}
  function refreshUI(fps,frameP95){
    const room=roomAt();if(room)visited.add(room.id);
    const name=room?.name||(player.z>22?'入口':player.z<-12?'通りの奥':'');if($('location').textContent!==name)$('location').textContent=name;
    if(qa){$('diagnostic').hidden=false;$('diagnostic').textContent=`${reviewLabel?reviewLabel+'\n':''}${innerWidth}×${innerHeight} / ${touch?'touch UI':'PC'} / ${Math.round(fps)} fps / p95 ${Math.round(frameP95)} ms\n位置 ${player.x.toFixed(2)}, ${player.z.toFixed(2)} / 方位 ${(player.yaw*180/Math.PI).toFixed(0)} / 仰角 ${(player.pitch*180/Math.PI).toFixed(0)}\n${room?.name||'街路'} / 対象 ${active?.id||'—'}\n描画 ${renderer.info.render.calls} / 三角形 ${renderer.info.render.triangles} / DPR ${dpr.toFixed(2)} / textures ${textureCount()}\n入店 ${[...visited].join(', ')||'—'}`;}
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;controls.enabled=false;controls.reset();sound.suspend();notice('表示が中断しました。復帰を待っています。');});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;controls.enabled=running&&!paused;controls.reset();last=0;notice('通りに戻りました。');});
  addEventListener('visibilitychange',()=>{last=0;frames=[];if(document.hidden){save();sound.suspend();}else sound.resume();});
  addEventListener('pagehide',()=>{save();sound.suspend();});
  addEventListener('pageshow',()=>{controls.reset();last=0;resize();sound.resume();});
  function animate(t){
    requestAnimationFrame(animate);if(document.hidden||contextLost)return;
    const raw=last?(t-last)/1000:1/60,dt=Math.min(raw,.05);last=t;elapsed+=dt;
    if(running&&!paused){const {f,s}=controls.read(dt);if(f||s)move(f,s,dt*1.65);}
    updateCamera();
    const nearest=roomAt()||world.rooms.filter(r=>['imoji','objects','miharai','archive','shikigami'].includes(r.id)).reduce((a,b)=>Math.abs(a.z-player.z)<Math.abs(b.z-player.z)?a:b);
    const destination=new THREE.Vector3(nearest.side*(2.1+nearest.d*.48),nearest.h-.28,nearest.z);
    warm.position.lerp(destination,1-Math.exp(-dt*3));fill.position.set(player.x*.25,2.82,player.z-3);
    const calm=$('calm').checked;
    if(!calm&&!paused){for(const fan of world.fans)fan.rotation.z+=dt*2.2;}
    for(const l of world.lights){const phase=elapsed%19,dim=!calm&&phase>15.0&&phase<15.22;l.mesh.material.color.copy(l.color).multiplyScalar(dim?.4:1);}
    sound.update(player,elapsed,paused||!running);
    if(running&&!paused){scan+=dt;if(scan>.11){scan=0;active=findTarget();$('interact').hidden=!active;document.body.classList.toggle('has-target',!!active);if(active)$('target-label').textContent=active.label;}}
    else {$('interact').hidden=true;document.body.classList.remove('has-target');}
    renderer.render(scene,camera);
    if(running&&!paused){frames.push(raw*1000);uiClock+=raw;saved+=dt;
      if(uiClock>=1.5){
        const sorted=[...frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||16.7;
        const fps=frames.length*1000/Math.max(1,frames.reduce((sum,n)=>sum+n,0));refreshUI(fps,p95);
        if(quality==='auto'){
          slow=fps<32?slow+1:0;fast=fps>54?fast+1:0;
          if(slow>=2&&dpr>.7){dpr=Math.max(.7,dpr-.15);resize();slow=0;}
          if(fast>=12&&dpr<Math.min(devicePixelRatio||1,touch?1.2:1.5)){dpr=Math.min(dpr+.1,devicePixelRatio||1,touch?1.2:1.5);resize();fast=0;}
        }
        frames=[];uiClock=0;
      }if(saved>3){save();saved=0;}
    }
  }
  updateCamera();warm.position.set(-4,2.4,16);fill.position.set(0,2.8,20);
  renderer.render(scene,camera);requestAnimationFrame(animate);
  $('enter').disabled=false;$('enter').textContent='歩く';
  $('enter').onclick=()=>{running=true;controls.enabled=true;$('gate').hidden=true;document.querySelector('.top').hidden=false;showControls();canvas.focus({preventScroll:true});refreshUI(0,0);};
}
