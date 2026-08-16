import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import * as THREE from 'three';

const clamp = {extrapolateLeft:'clamp' as const, extrapolateRight:'clamp' as const};

const makeCylinderBetween = (a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material) => {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,14),mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().sub(a).normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const buildBot = () => {
  const bot = new THREE.Group();
  bot.name='TeruteruBot';

  const white = new THREE.MeshPhysicalMaterial({
    color:0xf4f4f1, roughness:0.16, metalness:0.12, clearcoat:1, clearcoatRoughness:0.08
  });
  const white2 = new THREE.MeshPhysicalMaterial({
    color:0xdededa, roughness:0.24, metalness:0.22, clearcoat:0.9, clearcoatRoughness:0.12
  });
  const dark = new THREE.MeshStandardMaterial({color:0x111317,roughness:0.3,metalness:0.78});
  const black = new THREE.MeshPhysicalMaterial({color:0x020204,roughness:0.08,metalness:0.45,clearcoat:1});
  const chrome = new THREE.MeshStandardMaterial({color:0xc9cbce,roughness:0.12,metalness:0.96});

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1,48,36),white);
  torso.scale.set(1.15,1.48,0.92);
  torso.position.y=-0.3;
  torso.castShadow=true;
  bot.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.88,40,28),white2);
  belly.scale.set(1.05,1.25,0.74);
  belly.position.set(0,-0.46,0.38);
  belly.castShadow=true;
  bot.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.82,48,36),white);
  head.scale.set(1.05,0.92,0.95);
  head.position.set(0,1.15,0.05);
  head.castShadow=true;
  bot.add(head);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.66,0.12,18,64),chrome);
  collar.rotation.x=Math.PI/2;
  collar.position.set(0,0.52,0.08);
  collar.castShadow=true;
  bot.add(collar);

  const eyeHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.37,0.43,0.24,40),dark);
  eyeHousing.rotation.x=Math.PI/2;
  eyeHousing.position.set(0,1.2,0.78);
  bot.add(eyeHousing);
  const eyeLens = new THREE.Mesh(new THREE.SphereGeometry(0.27,36,24),black);
  eyeLens.scale.z=0.38;
  eyeLens.position.set(0,1.2,0.94);
  bot.add(eyeLens);
  const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.33,0.055,16,48),chrome);
  eyeRing.position.set(0,1.2,0.99);
  bot.add(eyeRing);
  const eyeGlint = new THREE.Mesh(new THREE.SphereGeometry(0.055,16,12),new THREE.MeshBasicMaterial({color:0xffffff}));
  eyeGlint.position.set(-0.09,1.3,1.16);
  bot.add(eyeGlint);

  // Layered armor petals around the torso.
  for(let i=0;i<14;i++){
    const ang=(i/14)*Math.PI*2;
    const plate=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.62,0.12),i%3===0?white2:white);
    plate.position.set(Math.cos(ang)*0.98,-0.12+((i%2)*0.22),Math.sin(ang)*0.68);
    plate.rotation.y=-ang+Math.PI/2;
    plate.rotation.z=Math.sin(ang)*0.17;
    plate.castShadow=true;
    bot.add(plate);
    const rivet=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,8),chrome);
    rivet.position.copy(plate.position).add(new THREE.Vector3(Math.cos(ang)*0.18,0.18,Math.sin(ang)*0.12));
    bot.add(rivet);
  }

  // Deterministic greebles.
  for(let i=0;i<64;i++){
    const u=(i*0.61803398875)%1;
    const v=(i*0.41421356237)%1;
    const ang=u*Math.PI*2;
    const y=-1.15+v*2.2;
    const rad=0.96*Math.sqrt(Math.max(0,1-(y/1.55)*(y/1.55)));
    const p=new THREE.Vector3(Math.cos(ang)*rad,y,Math.sin(ang)*rad*0.8);
    const geom=i%4===0?new THREE.CylinderGeometry(0.055,0.055,0.16,10):new THREE.BoxGeometry(0.10+(i%3)*0.035,0.08+(i%4)*0.025,0.08);
    const g=new THREE.Mesh(geom,i%5===0?dark:(i%2?white2:chrome));
    g.position.copy(p);
    g.lookAt(p.clone().multiplyScalar(2));
    g.rotation.z += (i%7)*0.11;
    g.castShadow=true;
    bot.add(g);
  }

  // Antennae / horns.
  for(let i=0;i<10;i++){
    const ang=-1.35+(i/9)*2.7;
    const a=new THREE.Vector3(Math.sin(ang)*0.62,1.63,Math.cos(ang)*0.37);
    const b=a.clone().add(new THREE.Vector3(Math.sin(ang)*0.42,0.45+(i%3)*0.12,Math.cos(ang)*0.28));
    bot.add(makeCylinderBetween(a,b,0.04,i%3===0?chrome:white2));
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,8),chrome);
    tip.position.copy(b);
    bot.add(tip);
  }

  // Articulated cable-legs.
  for(let i=0;i<10;i++){
    const ang=(i/10)*Math.PI*2;
    const root=new THREE.Vector3(Math.cos(ang)*0.72,-1.17,Math.sin(ang)*0.50);
    const j1=root.clone().add(new THREE.Vector3(Math.cos(ang)*0.42,-0.28,Math.sin(ang)*0.40));
    const j2=j1.clone().add(new THREE.Vector3(Math.cos(ang+0.4)*0.32,-0.42,Math.sin(ang+0.4)*0.28));
    const j3=j2.clone().add(new THREE.Vector3(Math.cos(ang-0.2)*0.28,-0.34,Math.sin(ang-0.2)*0.24));
    bot.add(makeCylinderBetween(root,j1,0.075,white2));
    bot.add(makeCylinderBetween(j1,j2,0.065,chrome));
    bot.add(makeCylinderBetween(j2,j3,0.05,white));
    [j1,j2].forEach((p,k)=>{
      const joint=new THREE.Mesh(new THREE.SphereGeometry(k===0?0.12:0.10,18,12),k===0?dark:chrome);
      joint.position.copy(p);bot.add(joint);
    });
  }

  // Shoulder fins / machine-biological silhouette.
  for(let side of [-1,1]){
    for(let i=0;i<5;i++){
      const a=new THREE.Vector3(side*(0.82+i*0.07),0.65-i*0.32,0.0);
      const b=new THREE.Vector3(side*(1.55+i*0.12),0.95-i*0.43,-0.12+(i%2)*0.18);
      bot.add(makeCylinderBetween(a,b,0.055,i%2===0?white:chrome));
      const blade=new THREE.Mesh(new THREE.ConeGeometry(0.11,0.40,10),white2);
      blade.position.copy(b);
      blade.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
      bot.add(blade);
    }
  }

  bot.traverse((o)=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});
  return bot;
};

const makeRain = () => {
  const count=180;
  const positions=new Float32Array(count*6);
  for(let i=0;i<count;i++){
    const x=((i*73)%101)/101*10-5;
    const y=((i*193)%211)/211*12-2;
    const z=-1-(((i*47)%97)/97)*7;
    const len=0.24+((i*13)%11)/11*0.42;
    positions[i*6]=x;positions[i*6+1]=y;positions[i*6+2]=z;
    positions[i*6+3]=x-0.05;positions[i*6+4]=y-len;positions[i*6+5]=z;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const mat=new THREE.LineBasicMaterial({color:0xcdd8df,transparent:true,opacity:0.35});
  const rain=new THREE.LineSegments(geo,mat);
  return rain;
};

export const TeruteruBotCG:React.FC=()=>{
  const frame=useCurrentFrame();
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const state=useRef<null|{renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;bot:THREE.Group;rain:THREE.LineSegments;key:THREE.SpotLight;rim:THREE.SpotLight;floor:THREE.Mesh}>(null);

  useLayoutEffect(()=>{
    if(!canvasRef.current || state.current) return;
    const renderer=new THREE.WebGLRenderer({canvas:canvasRef.current,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setSize(720,1280,false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x06080a);
    scene.fog=new THREE.FogExp2(0x080a0c,0.06);

    const camera=new THREE.PerspectiveCamera(38,720/1280,0.1,100);
    camera.position.set(0,0.25,6.2);

    const bot=buildBot();
    bot.position.y=0.2;
    scene.add(bot);

    const floorMat=new THREE.MeshPhysicalMaterial({color:0x15181b,roughness:0.26,metalness:0.34,clearcoat:0.9,clearcoatRoughness:0.18});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,18),floorMat);
    floor.rotation.x=-Math.PI/2;
    floor.position.y=-2.18;
    floor.receiveShadow=true;
    scene.add(floor);

    scene.add(new THREE.HemisphereLight(0xcfd8df,0x111318,1.15));
    const key=new THREE.SpotLight(0xffffff,95,20,Math.PI/5,0.48,1.2);
    key.position.set(3.8,5.5,5.2);key.target=bot;key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
    const rim=new THREE.SpotLight(0xd8eaff,70,18,Math.PI/4,0.55,1.4);
    rim.position.set(-4.5,2.2,-1.8);rim.target=bot;scene.add(rim);
    const fill=new THREE.PointLight(0xffffff,28,11,1.7);fill.position.set(-2.5,0.3,4);scene.add(fill);

    const rain=makeRain();scene.add(rain);
    state.current={renderer,scene,camera,bot,rain,key,rim,floor};
    return()=>{renderer.dispose();state.current=null;};
  },[]);

  useLayoutEffect(()=>{
    const s=state.current;if(!s)return;
    const t=frame/30;
    const shot=frame;
    const reveal=interpolate(frame,[0,45],[0,1],clamp);
    s.key.intensity=55+reveal*55;
    s.rim.intensity=35+reveal*55;
    s.bot.rotation.y = frame<120 ? -0.55+frame*0.006 : frame<300 ? 0.18+(frame-120)*0.008 : 1.10+(frame-300)*0.002;
    s.bot.rotation.z = Math.sin(t*0.9)*0.025;
    s.bot.position.y = 0.18+Math.sin(t*1.2)*0.035;
    s.rain.position.y = -((frame*0.19)%3.3);
    (s.rain.material as THREE.LineBasicMaterial).opacity = frame<95 || (frame>292&&frame<390) ? 0.42 : 0.06;

    if(shot<90){
      const p=interpolate(shot,[0,90],[0,1],clamp);
      s.camera.position.set(1.0-p*0.55,0.55-p*0.12,5.1-p*0.75);
      s.camera.lookAt(0,0.28,0);
      s.scene.background=new THREE.Color(0x050709);
    }else if(shot<210){
      const p=(shot-90)/120;
      s.camera.position.set(Math.sin(p*1.25)*3.0,0.45,5.0-Math.sin(p*Math.PI)*0.55);
      s.camera.lookAt(0,0.15,0);
      s.scene.background=new THREE.Color(0x0b0d0f);
    }else if(shot<300){
      const p=(shot-210)/90;
      s.camera.position.set(0.85-p*1.15,1.05-p*0.15,3.25-p*0.25);
      s.camera.lookAt(0,0.85,0.25);
      s.scene.background=new THREE.Color(0x0c0f12);
    }else if(shot<390){
      const p=(shot-300)/90;
      s.camera.position.set(-1.3+p*0.65,0.20,4.25+p*0.4);
      s.camera.lookAt(0,-0.05,0);
      s.key.intensity=42;
      s.rim.intensity=85;
      s.scene.background=new THREE.Color(0x030405);
    }else{
      const p=(shot-390)/60;
      s.camera.position.set(0,0.3,4.4+p*0.9);
      s.camera.lookAt(0,0.15,0);
      s.scene.background=new THREE.Color(0x08090a);
    }
    s.renderer.render(s.scene,s.camera);
  },[frame]);

  const titleOpacity=interpolate(frame,[18,34,72,84],[0,1,1,0],clamp);
  const lineOpacity=interpolate(frame,[112,128,184,202],[0,1,1,0],clamp);
  const weakOpacity=interpolate(frame,[314,330,370,386],[0,1,1,0],clamp);
  const endOpacity=interpolate(frame,[398,410,448,450],[0,1,1,0],clamp);

  return <AbsoluteFill style={{backgroundColor:'#050607',overflow:'hidden'}}>
    <canvas ref={canvasRef} width={720} height={1280} style={{width:'100%',height:'100%'}}/>
    <AbsoluteFill style={{background:'radial-gradient(circle at 50% 44%, transparent 45%, rgba(0,0,0,.68) 100%)'}}/>
    <div style={{position:'absolute',left:44,right:44,bottom:120,color:'#f4f4f0',fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontWeight:700,fontSize:38,letterSpacing:5,textAlign:'center',opacity:titleOpacity,textShadow:'0 3px 20px rgba(0,0,0,.8)'}}>雨は、まだ降るのか。</div>
    <div style={{position:'absolute',left:44,right:44,bottom:110,color:'#f4f4f0',fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontWeight:700,fontSize:34,letterSpacing:4,textAlign:'center',opacity:lineOpacity,textShadow:'0 3px 20px rgba(0,0,0,.8)'}}>てるてる坊主は、次の段階へ。</div>
    <div style={{position:'absolute',left:38,right:38,bottom:120,color:'#f4f4f0',fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontWeight:800,fontSize:36,letterSpacing:4,textAlign:'center',opacity:weakOpacity,textShadow:'0 3px 20px rgba(0,0,0,.95)'}}>機械化したため、雨に弱い。</div>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',opacity:endOpacity,color:'#f6f6f2',textAlign:'center',background:'rgba(2,2,3,.56)'}}>
      <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontWeight:900,fontSize:62,letterSpacing:7}}>TERUTERU BOT</div>
      <div style={{marginTop:22,fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontSize:28,letterSpacing:7}}>テルテルボット</div>
      <div style={{marginTop:38,fontSize:19,letterSpacing:4,color:'#c8c8c3'}}>受注生産　／　画像は一例です。</div>
    </div>
  </AbsoluteFill>;
};
