import assert from 'node:assert/strict';
import * as THREE from '../arcade/vendor/three.module.min.js';
// Geometry tests do not need a GPU. Only texture painting is stubbed; these are
// the real authored meshes, world matrices, collision rules and raycasts.
const noop=()=>{},gradient={addColorStop:noop};
const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(a,k)=>a[k]||noop,set:(a,k,v)=>(a[k]=v,true)});
global.document={createElement:()=>({width:256,height:256,getContext:()=>context}),createElementNS:()=>({width:10,height:10,addEventListener:noop,removeEventListener:noop})};
const {buildWorld,batchStatics,canOccupy,movePlayer}=await import('../arcade/world.js');
const scene=new THREE.Scene(),world=buildWorld(scene);batchStatics(scene);scene.updateMatrixWorld(true);
assert.equal(world.rooms.length,8);assert.equal(world.targets.length,11);
const player={x:0,z:23.2};movePlayer(player,0,-36.5,world);assert(player.z<-13.2,'Street must be passable end to end');
movePlayer(player,0,-30,world);assert(player.z>-13.60,'Rear wall must stop the player');
movePlayer(player,0,80,world);assert(player.z<24.8,'Entrance boundary must stop the player');
const closed={x:0,z:18.65};movePlayer(closed,8,0,world);
assert(closed.x<1.95,'Closed storefront must stop movement from the street');

// Flood-fill navigable floor at human radius; each room and each physical link
// must be reachable from the entrance, not just exist behind a sealed facade.
const grid=.18,seen=new Set(),queue=[{x:0,z:23.22}],points=[];
const key=(x,z)=>`${Math.round(x/grid)},${Math.round(z/grid)}`;seen.add(key(0,23.22));
for(let i=0;i<queue.length;i++){
  const p=queue[i];points.push(p);
  for(const [dx,dz] of [[grid,0],[-grid,0],[0,grid],[0,-grid]]){
    const x=p.x+dx,z=p.z+dz,k=key(x,z);if(!seen.has(k)&&canOccupy(x,z,world)){seen.add(k);queue.push({x,z});}
  }
}
for(const id of ['imoji','shikigami','objects','miharai','archive']){
  const r=world.rooms.find(r=>r.id===id);
  const reachable=points.filter(p=>Math.sign(p.x)===r.side&&Math.abs(p.x)>2.8&&Math.abs(p.z-r.z)<r.w/2-.25);
  assert(reachable.length>20,`${id}: cannot enter and move inside`);
  console.log(`${id}: ${reachable.length} reachable interior sample positions`);
}
const ray=new THREE.Raycaster();ray.near=.03;ray.far=2.65;
for(const t of world.targets){
  let reachable=false;
  for(const p of points){
    const origin=new THREE.Vector3(p.x,1.62,p.z),dir=t.position.clone().sub(origin),d=dir.length();
    if(d>2.6||d<.2||Math.abs(dir.y)/d>Math.sin(.84))continue;
    ray.set(origin,dir.normalize());
    const hit=ray.intersectObjects(scene.children,true).find(h=>!h.object.material.transparent||h.object.material.opacity>.55);
    if(hit&&(hit.object===t.mesh||hit.distance>d-.08)){reachable=true;break;}
  }
  assert(reachable,`Cannot reach and see interactive object: ${t.id}`);
  console.log(`Visible from accessible floor: ${t.id}`);
}
console.log(`PASS: end-to-end passage, walls, 5 interiors, 11 visible objects; ${points.length} floor samples.`);
