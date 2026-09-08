import * as THREE from './vendor/three.module.min.js';
import { surface, sign, shadowMap, random } from './surfaces.js';
import { buildShops } from './shops.js';

export const FRONT = 2.1, NORTH = 25, SOUTH = -14, EYE = 1.62;
const boxGeometry = new THREE.BoxGeometry(1,1,1), planeGeometry = new THREE.PlaneGeometry(1,1);
const cylinderGeometry = new THREE.CylinderGeometry(1,1,1,10);
const sphereGeometry = new THREE.SphereGeometry(1,10,7);
const solidCache = new Map();
export function paint(color) {
  if(!solidCache.has(color))solidCache.set(color,new THREE.MeshLambertMaterial({color}));
  return solidCache.get(color);
}

export function buildWorld(scene) {
  const colliders=[], rooms=[], targets=[], fans=[], lights=[], zones=[{minX:-FRONT,maxX:FRONT,minZ:SOUTH,maxZ:NORTH}];
  const m={
    concrete:surface('concrete','#727267'), plaster:surface('plaster','#989584'),
    wood:surface('wood','#463329'), blackwood:surface('wood','#29251f'),
    tile:surface('tile','#a5aa90'), floor:surface('floor','#696b5f'),
    shutter:surface('shutter','#808072'), rust:surface('metal','#79604c'),
    metal:surface('metal','#64706b'), brick:surface('brick','#73604e'),
    roof:surface('roof','#797e65'), black:paint(0x171a16), brass:paint(0x8d7950),
    paper:paint(0xbdb6a0), cream:paint(0xa6a18e), pipe:paint(0x696e64),
  };
  function add(parent,geometry,mat,x,y,z,sx,sy,sz,solid=false) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);
    if(solid){parent.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);const b=new THREE.Box3().setFromObject(mesh);colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});}
    return mesh;
  }
  const box=(p,x,y,z,w,h,d,mat=m.concrete,solid=false)=>add(p,boxGeometry,mat,x,y,z,w,h,d,solid);
  const cylinder=(p,x,y,z,r,h,mat=m.pipe)=>add(p,cylinderGeometry,mat,x,y,z,r,h,r);
  const sphere=(p,x,y,z,r,mat=m.cream)=>add(p,sphereGeometry,mat,x,y,z,r,r,r);
  function panel(p,x,y,z,w,h,map,rotation=Math.PI) {
    const mat=new THREE.MeshLambertMaterial({map,side:THREE.DoubleSide});
    const mesh=add(p,planeGeometry,mat,x,y,z,w,h,1);mesh.rotation.y=rotation;return mesh;
  }
  const label=(p,x,y,z,w,h,text,opts={},rotation=Math.PI)=>panel(p,x,y,z,w,h,sign(text,opts),rotation);
  function shadow(p,x,z,w,d) {
    const mat=new THREE.MeshBasicMaterial({map:shadowMap(),transparent:true,depthWrite:false,toneMapped:false});
    const a=add(p,planeGeometry,mat,x,.018,z,w,d,1);a.rotation.x=-Math.PI/2;return a;
  }
  function cable(p,points,color=0x292c26,r=.012) {
    const curve=new THREE.CatmullRomCurve3(points.map(a=>new THREE.Vector3(...a)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,12,r,5,false),paint(color));p.add(mesh);return mesh;
  }
  function pipe(p,points,r=.04,mat=m.pipe) {
    for(let i=1;i<points.length;i++){
      const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),d=b.clone().sub(a);
      const q=cylinder(p,...a.clone().add(b).multiplyScalar(.5).toArray(),r,d.length(),mat);
      q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
      sphere(p,...a.toArray(),r*1.17,mat);
    }
  }
  function tube(p,x,y,z,len=1.0,color=0xdfdfb1,broken=false) {
    box(p,x,y+.04,z,len+.14,.065,.14,m.metal);
    const mat=new THREE.MeshBasicMaterial({color,toneMapped:false});
    const mesh=box(p,x,y,z,len,.028,.047,mat);
    if(broken){mesh.userData.live=true;lights.push({mesh,color:new THREE.Color(color)});}
  }
  function fan(p,x,y,z,size=.45) {
    box(p,x,y,z,size+.16,size+.16,.2,m.metal);
    const disk=cylinder(p,x,y,z-.12,size*.44,.025,m.black);disk.rotation.x=Math.PI/2;
    const hub=new THREE.Group();hub.position.set(x,y,z-.15);p.add(hub);
    for(let i=0;i<4;i++){const blade=box(hub,0,0,0,size*.8,size*.17,.024,m.cream);blade.rotation.z=i*Math.PI/2+.32;}
    sphere(hub,0,0,-.023,size*.11,m.metal);fans.push(hub);
    for(let i=-2;i<=2;i++)box(p,x+i*size*.16,y,z-.2,.014,size*.88,.018,m.pipe);
  }
  function utility(p,x,y,z,kind=0) {
    if(kind===0){
      box(p,x,y,z,.68,.43,.32,m.cream);fan(p,x-.15,y,z-.17,.28);
      for(let i=0;i<6;i++)box(p,x+.22,y-.14+i*.055,z-.18,.16,.011,.018,m.pipe);
      pipe(p,[[x+.32,y,z],[x+.47,y-.04,z],[x+.47,.22,z],[x+.7,.22,z]],.028,m.rust);
      shadow(p,x,z,.88,.7);
    }else{
      box(p,x,y,z,.32,.57,.18,m.metal);box(p,x,y-.06,z-.11,.24,.29,.03,m.cream);
      const face=cylinder(p,x,y+.13,z-.12,.075,.025,m.paper);face.rotation.x=Math.PI/2;
      box(p,x+.11,y-.12,z-.145,.025,.08,.02,m.rust);
      cable(p,[[x,y+.28,z],[x+.09,y+.57,z],[x-.25,2.9,z],[x+.8,3.12,z]]);
    }
  }
  function room(id,name,side,z,w,d,h,wall=m.plaster,floor=m.floor){
    const group=new THREE.Group();group.position.set(side*FRONT,0,z);group.rotation.y=side*Math.PI/2;scene.add(group);
    const record={id,name,side,z,w,d,h,group};rooms.push(record);
    const x1=side*FRONT,x2=side*(FRONT+d);zones.push({minX:Math.min(x1,x2),maxX:Math.max(x1,x2),minZ:z-w/2,maxZ:z+w/2});
    box(group,0,-.055,d/2,w,.11,d,floor);
    box(group,0,h+.07,d/2,w+.12,.14,d+.12,m.concrete);
    box(group,-w/2,h/2,d/2,.16,h,d,wall,true);box(group,w/2,h/2,d/2,.16,h,d,wall,true);
    box(group,0,h/2,d,w,h,.15,wall,true);
    return record;
  }
  // A real doorway: front piers and lintel, no hidden full-width collision box.
  function front(r,doorX,doorW,doorH,mat=m.plaster) {
    const left=-r.w/2,right=r.w/2,lo=doorX-doorW/2,hi=doorX+doorW/2;
    if(lo>left)box(r.group,(lo+left)/2,r.h/2,0,lo-left,r.h,.16,mat,true);
    if(hi<right)box(r.group,(hi+right)/2,r.h/2,0,right-hi,r.h,.16,mat,true);
    box(r.group,doorX,(doorH+r.h)/2,0,doorW,r.h-doorH,.16,mat);
    box(r.group,doorX,.013,0,doorW,.02,.32,m.brass);
    return r;
  }
  function target(mesh,id,labelText,{href=null,text='',onUse=null}={}) {
    mesh.userData.live=true;mesh.updateWorldMatrix(true,false);
    targets.push({mesh,id,label:labelText,href,text,onUse,position:mesh.getWorldPosition(new THREE.Vector3())});return mesh;
  }
  function desk(p,x,z,w=1.45,d=.62,mat=m.wood){
    box(p,x,.79,z,w,.09,d,mat,true);
    for(const a of [-1,1])for(const b of [-1,1])box(p,x+a*(w/2-.07),.37,z+b*(d/2-.07),.065,.74,.065,m.metal);
    shadow(p,x,z,w*1.4,d*1.9);
  }
  function shelf(p,x,z,w=1.3,h=1.8,d=.38){
    for(const a of [-1,1])box(p,x+a*w/2,h/2,z,.035,h,d,m.metal,true);
    for(let j=0;j<4;j++)box(p,x,.16+j*(h-.25)/3,z,w,.035,d,m.wood,true);
    shadow(p,x,z,w*1.25,d*1.8);
  }
  const api={scene,m,box,cylinder,sphere,panel,label,shadow,cable,pipe,tube,fan,utility,room,front,target,desk,shelf,paint};
  // Retain the low covered passage, concrete structure, gutters and service wiring.
  box(scene,0,-.065,5.5,FRONT*2,.12,NORTH-SOUTH,m.concrete);
  const floorMap=m.floor.map.clone();floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(1,10);floorMap.needsUpdate=true;
  box(scene,0,-.012,5.5,3.92,.02,NORTH-SOUTH,new THREE.MeshLambertMaterial({map:floorMap}));
  for(const side of [-1,1]){
    box(scene,side*2.04,.023,5.5,.1,.04,39,m.rust);
    box(scene,side*2.06,3.22,5.5,.16,.14,39,m.metal);
    pipe(scene,[[side*1.95,2.98,24],[side*1.9,2.98,13],[side*1.88,2.85,12],[side*1.88,2.85,-13]],.055,m.rust);
  }
  for(let z=-13;z<25;z+=2.25){
    // Two slopes, patched translucent-looking corrugation, central spine, rain gutters.
    for(const side of [-1,1]){
      const roof=box(scene,side*1.1,3.52,z,2.27,.044,2.18,((z+13)/2.25)%7===0?m.metal:m.roof);roof.rotation.z=side*-.13;
      const beam=box(scene,side*1.1,3.47,z-1.09,2.28,.07,.09,m.rust);beam.rotation.z=side*-.13;
    }
    box(scene,0,3.69,z,.08,.1,2.25,m.metal);
  }
  const rr=random(51);
  for(let i=0;i<12;i++){
    const z=23-i*3.1;
    cable(scene,[[-2.02,3.13,z],[-1.1,2.91,z-.22],[.65,2.88,z+.16],[2.1,3.02,z-.14]],i%4?0x252720:0x665b44,.013);
    if(i%3===0)cable(scene,[[-2.07,3.17,z],[-.2,2.84,z+.72],[2.05,2.94,z+1.12]],0x323528,.016);
    if(i%2===0)tube(scene,.12,3.22,z-1.2,.84,i%4===0?0xe5d7b1:0xc6d4ba,i===10);
  }
  for(let i=0;i<25;i++){
    const z=23-i*1.45,x=i%2?1.8:-1.78;
    box(scene,x,.012,z,.31,.025,.66,m.black);
    for(let j=0;j<7;j++)box(scene,x,.03,z-.25+j*.08,.28,.015,.022,m.metal);
    if(i%3===0){
      const wet=new THREE.MeshPhongMaterial({color:0x343d31,shininess:95,specular:0x909481,transparent:true,opacity:.46,depthWrite:false});
      const patch=add(scene,planeGeometry,wet,x*.43,.022,z,rr()*.4+.5,rr()+.7,1);patch.rotation.x=-Math.PI/2;patch.rotation.z=rr();
    }
  }
  buildShops(api);
  // Infill closes the irregular gaps without cloning storefronts.
  for(const side of [-1,1]){
    const occupied=rooms.filter(r=>r.side===side).map(r=>[r.z-r.w/2,r.z+r.w/2]).sort((a,b)=>a[0]-b[0]);
    let edge=SOUTH;
    for(const [a,b] of [...occupied,[NORTH,NORTH]]){
      if(a>edge){const len=a-edge;box(scene,side*(FRONT+.12),1.55,(edge+a)/2,.22,3.1,len,m.concrete,true);}
      edge=Math.max(edge,b);
    }
  }
  // Entrances are recognisable ends of the same street; neither teleports the walker.
  box(scene,0,2.98,24.6,4.25,.46,.22,m.rust);
  label(scene,0,2.97,24.46,3.7,.34,'不氣屋アーケード',{bg:'#465147',fg:'#b8b494'},Math.PI);
  box(scene,0,1.4,-13.95,4.3,2.8,.18,m.plaster,true);
  box(scene,.68,1.06,-13.81,1.08,2.12,.12,m.metal,true);
  label(scene,.68,2.32,-13.71,.55,.22,'出口',{bg:'#3a4a3e',fg:'#cac8a9'},0);
  const out=label(scene,.68,1.5,-13.70,.6,.36,'通りへ',{bg:'#807d66',fg:'#222820'},0);
  target(out,'street-exit','通りへ',{href:'../',text:''});
  utility(scene,-1.1,1.65,-13.7,1);
  return {colliders,rooms,targets,fans,lights,zones,api};
}

export function canOccupy(x,z,world,r=.21){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  for(const [a,b] of [[0,0],[-r,0],[r,0],[0,-r],[0,r],[-r*.7,-r*.7],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7]])
    if(!world.zones.some(q=>x+a>=q.minX&&x+a<=q.maxX&&z+b>=q.minZ&&z+b<=q.maxZ))return false;
  for(const b of world.colliders){const X=Math.max(b.minX,Math.min(x,b.maxX)),Z=Math.max(b.minZ,Math.min(z,b.maxZ));if((x-X)**2+(z-Z)**2<r*r)return false;}
  return true;
}
export function movePlayer(player,dx,dz,world){
  // Substeps avoid tunnelling after a slow frame; axis separation slides along walls.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
  for(let i=0;i<n;i++){if(canOccupy(player.x+dx/n,player.z,world))player.x+=dx/n;if(canOccupy(player.x,player.z+dz/n,world))player.z+=dz/n;}
}
export function batchStatics(scene){
  scene.updateMatrixWorld(true);const buckets=new Map(),candidates=[];
  scene.traverse(o=>{if(o.isMesh&&!o.userData.live){let p=o.parent,live=false;while(p){if(p.userData.live)live=true;p=p.parent;}if(!live)candidates.push(o);}});
  for(const o of candidates){
    // Spatial buckets preserve useful frustum culling even after instancing.
    const key=o.geometry.uuid+o.material.uuid+Math.floor(o.matrixWorld.elements[14]/8);
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
  }
  for(const list of buckets.values()){
    if(list.length<3)continue;const a=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);
    list.forEach((o,i)=>{a.setMatrixAt(i,o.matrixWorld);o.removeFromParent();});
    a.instanceMatrix.needsUpdate=true;a.computeBoundingSphere();scene.add(a);
  }
}
