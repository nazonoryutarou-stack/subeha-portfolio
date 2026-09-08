export function createControls(canvas,{step,turn,inspect,changed}) {
  const keys=new Map(),pads=new Map();let view=null,stickId=null,sx=0,sy=0;
  const stick=document.getElementById('joystick'),knob=document.getElementById('stick');
  const axes={KeyW:[1,0],ArrowUp:[1,0],KeyS:[-1,0],ArrowDown:[-1,0],KeyA:[0,-1],KeyD:[0,1]};
  const directions={forward:[1,0],back:[-1,0],left:[0,-1],right:[0,1]};
  const control={enabled:false,reset,read,looked:false};
  function reset(){keys.clear();pads.clear();sx=sy=0;stickId=null;view=null;knob.style.transform='';document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
  function read(dt){
    let f=sy,s=sx;for(const [k] of keys){if(axes[k]){f+=axes[k][0];s+=axes[k][1];}}
    for(const p of pads.values()){f+=p.axis[0];s+=p.axis[1];}
    if(keys.has('ArrowLeft'))turn(-dt*1.35,0);if(keys.has('ArrowRight'))turn(dt*1.35,0);
    const l=Math.max(1,Math.hypot(f,s));return {f:f/l,s:s/l};
  }
  addEventListener('keydown',e=>{
    if(!control.enabled||e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)inspect();return;}
    if(!axes[e.code]&&!['ArrowLeft','ArrowRight'].includes(e.code))return;
    e.preventDefault();if(!keys.has(e.code))keys.set(e.code,performance.now());
  });
  addEventListener('keyup',e=>{
    const t=keys.get(e.code);keys.delete(e.code);
    if(t===undefined||!control.enabled)return;
    // A brief tap remains usable even when it falls between two render frames.
    if(performance.now()-t<100){if(axes[e.code])step(...axes[e.code],.18);else turn(e.code==='ArrowLeft'?-.15:.15,0);}
  });
  canvas.addEventListener('pointerdown',e=>{
    if(!control.enabled||view||e.button!==0)return;
    if(e.pointerType==='touch'&&e.clientX<innerWidth*.38)return;
    view={id:e.pointerId,x:e.clientX,y:e.clientY,total:0};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointermove',e=>{
    if(!control.enabled)return;
    if(document.pointerLockElement===canvas){turn(e.movementX*.0025,-e.movementY*.0025);return;}
    if(!view||view.id!==e.pointerId)return;
    const dx=e.clientX-view.x,dy=e.clientY-view.y;
    view.x=e.clientX;view.y=e.clientY;view.total+=Math.abs(dx)+Math.abs(dy);
    turn(dx*.004,-dy*.0035);control.looked=true;changed();
  });
  const endView=e=>{
    if(!view||view.id!==e.pointerId)return;
    const click=view.total<7&&e.type==='pointerup';view=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(click)inspect({x:e.clientX,y:e.clientY});
  };
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,endView);
  const updateStick=e=>{
    const rect=stick.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
    const radius=rect.width*.32,distance=Math.hypot(dx,dy),ratio=distance>radius?radius/distance:1;
    sx=dx*ratio/radius;sy=-dy*ratio/radius;if(distance<7)sx=sy=0;
    knob.style.transform=`translate(${dx*ratio}px,${dy*ratio}px)`;changed();
  };
  stick.addEventListener('pointerdown',e=>{if(!control.enabled||stickId!==null)return;e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)updateStick(e);});
  const releaseStick=e=>{if(e.pointerId!==stickId)return;stickId=null;sx=sy=0;knob.style.transform='';if(stick.hasPointerCapture(e.pointerId))stick.releasePointerCapture(e.pointerId);};
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(evt,releaseStick);
  for(const button of document.querySelectorAll('[data-move]')){
    const axis=directions[button.dataset.move];
    button.addEventListener('pointerdown',e=>{if(!control.enabled)return;e.preventDefault();pads.set(e.pointerId,{axis,t:performance.now()});button.setPointerCapture(e.pointerId);button.classList.add('held');});
    const release=e=>{
      const held=pads.get(e.pointerId);pads.delete(e.pointerId);button.classList.remove('held');
      if(held&&control.enabled&&e.type==='pointerup'&&performance.now()-held.t<180)step(...axis,.34);
      if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);
    };
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(evt,release);
    button.addEventListener('click',e=>{if(e.detail===0&&control.enabled)step(...axis,.34);});
  }
  addEventListener('blur',reset);addEventListener('visibilitychange',reset);addEventListener('pagehide',reset);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  return control;
}
