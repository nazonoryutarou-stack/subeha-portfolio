import React,{useLayoutEffect,useRef} from 'react';
import {AbsoluteFill,interpolate,useCurrentFrame} from 'remotion';
import * as THREE from 'three';

const C={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const cyl=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,segments=12)=>{const d=b.clone().sub(a);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),segments),m);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());o.castShadow=true;return o;};

const build=()=>{
 const g=new THREE.Group();
 const porcelain=new THREE.MeshPhysicalMaterial({color:0xf7f7f3,roughness:.13,metalness:.08,clearcoat:1,clearcoatRoughness:.06});
 const bone=new THREE.MeshPhysicalMaterial({color:0xd9dad6,roughness:.24,metalness:.18,clearcoat:.85,clearcoatRoughness:.14});
 const chrome=new THREE.MeshStandardMaterial({color:0xe3e5e5,roughness:.09,metalness:.95});
 const joint=new THREE.MeshStandardMaterial({color:0xbfc2c2,roughness:.24,metalness:.78});
 const lens=new THREE.MeshPhysicalMaterial({color:0x030405,roughness:.04,metalness:.38,clearcoat:1,clearcoatRoughness:.02});
 const add=(o:THREE.Object3D)=>{g.add(o);return o;};

 // Mechanical spine / core, mostly hidden by white armor.
 const spine=new THREE.Mesh(new THREE.CylinderGeometry(.26,.34,2.7,18),chrome);spine.position.y=-.15;add(spine);
 for(let y=-1.25;y<1.25;y+=.34){const ring=new THREE.Mesh(new THREE.TorusGeometry(.46,.055,10,28),joint);ring.rotation.x=Math.PI/2;ring.position.y=y;add(ring);}

 // Head shell: flattened, not a featureless ball.
 const head=new THREE.Mesh(new THREE.SphereGeometry(.77,36,28),porcelain);head.scale.set(1.05,.86,.91);head.position.y=1.42;add(head);
 const brow=new THREE.Mesh(new THREE.TorusGeometry(.50,.105,14,40,Math.PI*1.25),bone);brow.rotation.set(Math.PI/2,0,-Math.PI*.12);brow.position.set(0,1.52,.52);add(brow);
 const eyeBase=new THREE.Mesh(new THREE.CylinderGeometry(.34,.40,.24,32),chrome);eyeBase.rotation.x=Math.PI/2;eyeBase.position.set(0,1.43,.73);add(eyeBase);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.245,28,20),lens);eye.scale.z=.42;eye.position.set(0,1.43,.89);add(eye);
 const irisRing=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,10,32),porcelain);irisRing.position.set(0,1.43,1.01);add(irisRing);
 const glint=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));glint.position.set(-.08,1.52,1.10);add(glint);

 // Segmented skirt/body, intentionally closer to teru-teru silhouette.
 const skirt1=new THREE.Mesh(new THREE.CylinderGeometry(.83,1.15,.82,20,1,false),porcelain);skirt1.position.y=.44;add(skirt1);
 const skirt2=new THREE.Mesh(new THREE.CylinderGeometry(1.02,1.34,.82,20,1,false),bone);skirt2.position.y=-.31;add(skirt2);
 const skirt3=new THREE.Mesh(new THREE.CylinderGeometry(1.20,1.48,.67,20,1,false),porcelain);skirt3.position.y=-1.02;add(skirt3);
 for(const y of [.82,.05,-.68,-1.38]){const r=y>.5?1.02:y>-.3?1.22:y>-1?1.40:1.50;const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.085,12,48),chrome);ring.rotation.x=Math.PI/2;ring.position.y=y;add(ring);}

 // Separate skirt armor blades with deep gaps.
 for(let i=0;i<18;i++){
  const a=i/18*Math.PI*2;const rad=1.30;
  const p=new THREE.Vector3(Math.cos(a)*rad,-.61,Math.sin(a)*rad*.74);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.26,1.25,.12),i%4===0?bone:porcelain);plate.position.copy(p);plate.rotation.y=-a+Math.PI/2;plate.rotation.z=Math.cos(a)*.10;add(plate);
  const rail=cyl(new THREE.Vector3(Math.cos(a)*1.12,-1.32,Math.sin(a)*.64),new THREE.Vector3(Math.cos(a)*1.33,.03,Math.sin(a)*.79),.032,chrome,8);add(rail);
  for(const dy of [-.32,.16]){const riv=new THREE.Mesh(new THREE.SphereGeometry(.047,10,8),joint);riv.position.set(Math.cos(a)*1.37,-.62+dy,Math.sin(a)*.82);add(riv);}
 }

 // Shoulder exoskeletons and asymmetrical junk housings.
 for(const side of [-1,1]){
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.34,18,14),porcelain);shoulder.scale.set(1.25,.72,.85);shoulder.position.set(side*1.02,.87,.0);add(shoulder);
  for(let j=0;j<6;j++){
   const y=.82-j*.30;const root=new THREE.Vector3(side*(.93+j*.05),y,.0);const elbow=new THREE.Vector3(side*(1.40+j*.10),y+.10,(j%2?-.18:.18));const tip=new THREE.Vector3(side*(1.80+j*.14),y-.06,(j%3-.8)*.26);
   add(cyl(root,elbow,.065,j%2?chrome:bone));add(cyl(elbow,tip,.045,porcelain));
   const jj=new THREE.Mesh(new THREE.SphereGeometry(.11,14,10),joint);jj.position.copy(elbow);add(jj);
   const cap=new THREE.Mesh(new THREE.ConeGeometry(.105,.34,9),porcelain);cap.position.copy(tip);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tip.clone().sub(elbow).normalize());add(cap);
  }
 }

 // 3D greeble blocks on the body, larger and readable.
 for(let i=0;i<46;i++){
  const a=((i*137)%360)*Math.PI/180;const y=-1.15+((i*61)%100)/100*2.15;const base=1.12+(i%4)*.07;const x=Math.cos(a)*base;const z=Math.sin(a)*base*.72;
  const w=.14+(i%3)*.05,h=.12+(i%5)*.045,d=.10+(i%2)*.06;
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%6===0?chrome:(i%2?porcelain:bone));box.position.set(x,y,z);box.rotation.y=-a+Math.PI/2;box.rotation.z=(i%7-.3)*.06;add(box);
  if(i%4===0){const knob=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.13,10),joint);knob.rotation.z=Math.PI/2;knob.position.set(x*1.04,y+.08,z*1.04);add(knob);}
 }

 // Antennae crown, each with articulated base.
 for(let i=0;i<12;i++){
  const a=(-1.55+i/11*3.10);const root=new THREE.Vector3(Math.sin(a)*.58,1.78,Math.cos(a)*.35);const j=new THREE.Vector3(Math.sin(a)*.82,2.08+(i%3)*.08,Math.cos(a)*.50);const tip=new THREE.Vector3(Math.sin(a)*1.05,2.38+(i%2)*.16,Math.cos(a)*.68);
  add(cyl(root,j,.045,bone));add(cyl(j,tip,.032,chrome));const b=new THREE.Mesh(new THREE.SphereGeometry(.085,12,8),joint);b.position.copy(j);add(b);
 }

 // Hanging mechanical tendrils, gives the lower silhouette a living quality.
 for(let i=0;i<13;i++){
  const a=i/13*Math.PI*2;const root=new THREE.Vector3(Math.cos(a)*1.18,-1.31,Math.sin(a)*.70);const p1=root.clone().add(new THREE.Vector3(Math.cos(a)*.30,-.35,Math.sin(a)*.27));const p2=p1.clone().add(new THREE.Vector3(Math.cos(a+.55)*.30,-.36,Math.sin(a+.55)*.23));const p3=p2.clone().add(new THREE.Vector3(Math.cos(a-.22)*.23,-.31,Math.sin(a-.22)*.22));
  add(cyl(root,p1,.058,bone));add(cyl(p1,p2,.048,chrome));add(cyl(p2,p3,.036,porcelain));
  [p1,p2].forEach((p,k)=>{const q=new THREE.Mesh(new THREE.SphereGeometry(k? .085:.105,12,8),joint);q.position.copy(p);add(q);});
 }

 // Side sensor pods, deliberately mismatched.
 [[1.34,.28,.45],[-1.46,-.14,.20],[1.25,-.82,-.47],[-1.20,.64,-.40]].forEach((p,i)=>{const pod=new THREE.Mesh(new THREE.CylinderGeometry(.16,.20,.42,14),i%2?bone:porcelain);pod.rotation.z=Math.PI/2;pod.position.set(p[0],p[1],p[2]);add(pod);const tip=new THREE.Mesh(new THREE.SphereGeometry(.13,14,10),chrome);tip.position.set(p[0]+(p[0]>0?.24:-.24),p[1],p[2]);add(tip);});

 g.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 return g;
};

const rain=()=>{const n=120,p=new Float32Array(n*6);for(let i=0;i<n;i++){const x=((i*67)%113)/113*12-6,y=((i*173)%199)/199*14-3,z=-2-((i*37)%83)/83*9,l=.25+(i%9)*.035;p.set([x,y,z,x-.06,y-l,z],i*6);}const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.BufferAttribute(p,3));return new THREE.LineSegments(q,new THREE.LineBasicMaterial({color:0xd8e3e8,transparent:true,opacity:.28}));};

export const TeruteruBotCG2:React.FC=()=>{
 const frame=useCurrentFrame();const cv=useRef<HTMLCanvasElement>(null);const st=useRef<any>(null);
 useLayoutEffect(()=>{if(!cv.current||st.current)return;const r=new THREE.WebGLRenderer({canvas:cv.current,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});r.setSize(720,1280,false);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;
  const s=new THREE.Scene();s.background=new THREE.Color(0x07090b);s.fog=new THREE.Fog(0x07090b,8,20);const c=new THREE.PerspectiveCamera(34,720/1280,.1,100);const bot=build();bot.position.y=.12;s.add(bot);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshPhysicalMaterial({color:0x141719,roughness:.18,metalness:.42,clearcoat:1,clearcoatRoughness:.10}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.22;floor.receiveShadow=true;s.add(floor);
  s.add(new THREE.HemisphereLight(0xeaf0f3,0x111316,.82));const key=new THREE.SpotLight(0xffffff,145,24,Math.PI/5,.42,1.2);key.position.set(4.5,6.4,6.6);key.target=bot;key.castShadow=true;key.shadow.mapSize.set(1024,1024);s.add(key);const rim=new THREE.SpotLight(0xdceeff,105,22,Math.PI/4,.55,1.2);rim.position.set(-5.5,3,-3);rim.target=bot;s.add(rim);const front=new THREE.PointLight(0xffffff,42,14,1.5);front.position.set(-2.4,.6,5.5);s.add(front);const rr=rain();s.add(rr);st.current={r,s,c,bot,rr,key,rim};return()=>{r.dispose();st.current=null;};
 },[]);
 useLayoutEffect(()=>{const x=st.current;if(!x)return;const t=frame/30;x.bot.rotation.z=Math.sin(t*.8)*.018;x.bot.position.y=.12+Math.sin(t*1.1)*.025;x.rr.position.y=-((frame*.16)%3.5);(x.rr.material as THREE.LineBasicMaterial).opacity=(frame<95||frame>285&&frame<390)?.34:.025;
  if(frame<90){const p=frame/90;x.c.position.set(1.8-p*.8,.55,8.0-p*.65);x.bot.rotation.y=-.56+p*.28;x.c.lookAt(0,.05,0);x.key.intensity=70+p*80;}
  else if(frame<210){const p=(frame-90)/120;x.c.position.set(Math.sin(-.55+p*1.6)*3.4,.35,7.3-Math.sin(p*Math.PI)*.55);x.bot.rotation.y=-.2+p*.95;x.c.lookAt(0,-.05,0);x.key.intensity=150;}
  else if(frame<300){const p=(frame-210)/90;x.c.position.set(1.45-p*2.4,1.15,6.0-p*.4);x.bot.rotation.y=.78+p*.38;x.c.lookAt(0,.60,0);}
  else if(frame<390){const p=(frame-300)/90;x.c.position.set(-2.1+p*.8,.12,7.0+p*.35);x.bot.rotation.y=1.25+p*.22;x.c.lookAt(0,-.05,0);x.key.intensity=60;x.rim.intensity=140;}
  else{x.c.position.set(0,.25,7.4);x.bot.rotation.y=1.55;x.c.lookAt(0,0,0);x.key.intensity=115;x.rim.intensity=90;}
  x.r.render(x.s,x.c);
 },[frame]);
 const op=(a:number,b:number,c:number,d:number)=>interpolate(frame,[a,b,c,d],[0,1,1,0],C);
 return <AbsoluteFill style={{background:'#050607',overflow:'hidden'}}><canvas ref={cv} width={720} height={1280} style={{width:'100%',height:'100%'}}/><AbsoluteFill style={{background:'radial-gradient(circle at 50% 42%,transparent 48%,rgba(0,0,0,.63) 100%)'}}/>
 <div style={{position:'absolute',left:40,right:40,bottom:92,textAlign:'center',color:'#f5f5f0',font:'700 38px "Yu Mincho",serif',letterSpacing:5,opacity:op(14,28,72,86),textShadow:'0 3px 22px #000'}}>雨は、まだ降るのか。</div>
 <div style={{position:'absolute',left:40,right:40,bottom:92,textAlign:'center',color:'#f5f5f0',font:'700 33px "Yu Mincho",serif',letterSpacing:4,opacity:op(105,120,188,205),textShadow:'0 3px 22px #000'}}>てるてる坊主は、次の段階へ。</div>
 <div style={{position:'absolute',left:35,right:35,bottom:92,textAlign:'center',color:'#f5f5f0',font:'800 36px "Yu Mincho",serif',letterSpacing:4,opacity:op(312,326,370,386),textShadow:'0 3px 26px #000'}}>機械化したため、雨に弱い。</div>
 <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',color:'#f6f6f2',background:'rgba(2,3,4,.48)',opacity:op(397,410,448,450)}}><div style={{font:'900 61px Arial,sans-serif',letterSpacing:7}}>TERUTERU BOT</div><div style={{marginTop:19,font:'700 27px "Yu Mincho",serif',letterSpacing:7}}>テルテルボット</div><div style={{marginTop:35,fontSize:18,letterSpacing:4,color:'#d0d0cb'}}>受注生産　／　画像は一例です。</div></div>
 </AbsoluteFill>;
};
