import * as THREE from '../arcade/vendor/three.module.min.js';

export const EYE=1.62;
export const PLAYER_RADIUS=.28;
export const PLAN={minX:-5.35,maxX:5.35,minZ:-7.65,maxZ:10.85};

const wallSegments=[
  // left side of the central passage, with two deliberately uneven openings
  {x1:-1.82,x2:-1.58,z1:6.45,z2:10.55},
  {x1:-1.82,x2:-1.58,z1:-.25,z2:4.05},
  {x1:-1.82,x2:-1.58,z1:-6.95,z2:-2.65},
  // right side; openings do not mirror the left side
  {x1:1.58,x2:1.82,z1:5.55,z2:10.55},
  {x1:1.58,x2:1.82,z1:-2.15,z2:3.05},
  {x1:1.58,x2:1.82,z1:-6.95,z2:-4.55},
  // rear archive neck
  {x1:-5.05,x2:-.9,z1:-7.1,z2:-6.82},
  {x1:.9,x2:5.05,z1:-7.1,z2:-6.82}
];

const furnitureColliders=[
  {x1:-4.95,x2:-2.55,z1:6.7,z2:8.15}, // reception counter
  {x1:2.55,x2:4.9,z1:5.3,z2:6.55},   // document desk
  {x1:-4.95,x2:-3.85,z1:-.15,z2:3.45}, // tool shelves
  {x1:-3.5,x2:-2.2,z1:.35,z2:1.75},
  {x1:2.55,x2:4.75,z1:-1.65,z2:-.55}, // inspection bench
  {x1:3.75,x2:5.05,z1:-4.1,z2:-2.5},
  {x1:-4.95,x2:-3.65,z1:-6.45,z2:-3.1}, // archive shelves
  {x1:-3.4,x2:-2.35,z1:-5.85,z2:-4.35},
  {x1:2.55,x2:4.9,z1:-6.45,z2:-5.25}
];

export const COLLIDERS=[...wallSegments,...furnitureColliders];
export const ROOMS=[
  {id:'entry',name:'入口',x1:-1.55,x2:1.55,z1:6.4,z2:10.85},
  {id:'reception',name:'受付',x1:-5.35,x2:-1.85,z1:4.05,z2:10.55},
  {id:'documents',name:'書類机',x1:1.85,x2:5.35,z1:3.05,z2:10.55},
  {id:'workshop',name:'祭祀作業場',x1:-5.35,x2:-1.85,z1:-2.65,z2:4.0},
  {id:'inspection',name:'検品室',x1:1.85,x2:5.35,z1:-4.55,z2:3.0},
  {id:'archive',name:'保管庫',x1:-5.35,x2:-1.85,z1:-7.65,z2:-2.7},
  {id:'sealed',name:'閉鎖室前',x1:1.85,x2:5.35,z1:-7.65,z2:-4.6},
  {id:'rear',name:'奥廊下',x1:-1.55,x2:1.55,z1:-7.65,z2:6.35}
];

function insideExpanded(p,r,pad=PLAYER_RADIUS){return p.x>r.x1-pad&&p.x<r.x2+pad&&p.z>r.z1-pad&&p.z<r.z2+pad;}
export function canOccupy(x,z){
  if(x<PLAN.minX+PLAYER_RADIUS||x>PLAN.maxX-PLAYER_RADIUS||z<PLAN.minZ+PLAYER_RADIUS||z>PLAN.maxZ-PLAYER_RADIUS)return false;
  const p={x,z};return !COLLIDERS.some(r=>insideExpanded(p,r));
}
export function movePlayer(player,dx,dz){
  const nx=player.x+dx,nz=player.z+dz;
  if(canOccupy(nx,player.z))player.x=nx;
  if(canOccupy(player.x,nz))player.z=nz;
}
export function roomAt(x,z){return ROOMS.find(r=>x>=r.x1&&x<=r.x2&&z>=r.z1&&z<=r.z2)||null;}

function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function texture(seed,base,mark,mode='dust'){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=mulberry32(seed);
  x.fillStyle=base;x.fillRect(0,0,128,128);
  if(mode==='wood'){
    for(let i=0;i<58;i++){const y=r()*128;x.strokeStyle=`rgba(${mark},${.03+r()*.09})`;x.lineWidth=.5+r()*1.4;x.beginPath();x.moveTo(0,y);x.bezierCurveTo(34,y+r()*8-4,78,y+r()*8-4,128,y+r()*4-2);x.stroke();}
  }else{
    for(let i=0;i<900;i++){const a=.018+r()*.085,s=r()<.94?1:2+r()*3;x.fillStyle=`rgba(${mark},${a})`;x.fillRect(r()*128,r()*128,s,s);}
    for(let i=0;i<12;i++){x.strokeStyle=`rgba(${mark},${.025+r()*.06})`;x.lineWidth=.5+r()*2;x.beginPath();const sx=r()*128;x.moveTo(sx,0);x.lineTo(sx+r()*18-9,128);x.stroke();}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t;
}
function mat(map,color=0xffffff,rough=.9,metal=.03){return new THREE.MeshStandardMaterial({map,color,roughness:rough,metalness:metal});}
function box(scene,size,pos,material,name='',rotationY=0){const g=new THREE.BoxGeometry(...size),m=new THREE.Mesh(g,material);m.position.set(...pos);m.rotation.y=rotationY;m.name=name;scene.add(m);return m;}
function plane(scene,size,pos,rot,material,name=''){const g=new THREE.PlaneGeometry(...size),m=new THREE.Mesh(g,material);m.position.set(...pos);m.rotation.set(...rot);m.name=name;scene.add(m);return m;}
function cyl(scene,radius,length,pos,rot,material,segments=10){const g=new THREE.CylinderGeometry(radius,radius,length,segments),m=new THREE.Mesh(g,material);m.position.set(...pos);m.rotation.set(...rot);scene.add(m);return m;}
function signTexture(text,sub,fg='#d9d0b3',bg='#202019',accent='#9a6543'){
  const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=accent;x.fillRect(0,0,14,c.height);
  for(let i=0;i<120;i++){x.fillStyle=`rgba(235,225,190,${Math.random()*.035})`;x.fillRect(Math.random()*512,Math.random()*192,Math.random()*7+1,1);}
  x.fillStyle=fg;x.font='600 52px serif';x.fillText(text,42,86);x.fillStyle='#a9a895';x.font='24px sans-serif';x.fillText(sub,44,132);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function noticeTexture(lines){
  const c=document.createElement('canvas');c.width=384;c.height=512;const x=c.getContext('2d');x.fillStyle='#d2c9aa';x.fillRect(0,0,384,512);
  x.fillStyle='#38362d';x.font='700 30px serif';x.fillText(lines[0],28,54);x.strokeStyle='#706b58';x.beginPath();x.moveTo(26,72);x.lineTo(356,72);x.stroke();
  x.font='20px sans-serif';lines.slice(1).forEach((line,i)=>x.fillText(line,28,116+i*38));
  for(let i=0;i<240;i++){x.fillStyle=`rgba(70,52,30,${Math.random()*.045})`;x.fillRect(Math.random()*384,Math.random()*512,Math.random()*5+1,1);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export function buildWorld(scene){
  const concrete=texture(11,'#696b61','43,38,30'),plaster=texture(19,'#8a8878','58,49,36'),rust=texture(29,'#6f5a48','92,45,24'),wood=texture(37,'#5b4938','33,23,16','wood'),paper=texture(47,'#c5b996','85,61,37'),dark=texture(59,'#2a2c27','86,73,52');
  concrete.repeat.set(5,8);plaster.repeat.set(4,6);rust.repeat.set(2,5);wood.repeat.set(2,5);paper.repeat.set(3,4);dark.repeat.set(4,6);
  const M={floor:mat(concrete,0x8b8d80,1),wall:mat(plaster,0xb3af99,.97),steel:mat(rust,0x85705c,.72,.38),wood:mat(wood,0x77614b,.92),paper:mat(paper,0xd6cbaa,1),dark:mat(dark,0x464943,.86,.12),black:new THREE.MeshStandardMaterial({color:0x161914,roughness:.9}),glass:new THREE.MeshStandardMaterial({color:0x899686,roughness:.2,metalness:.05,transparent:true,opacity:.3}),screen:new THREE.MeshStandardMaterial({color:0x73906d,emissive:0x304a2c,emissiveIntensity:1.2,roughness:.45})};

  // shell: low ceiling at the entrance, higher patched ceiling in the work rooms
  plane(scene,[10.7,18.5],[0,.015,1.58],[-Math.PI/2,0,0],M.floor,'floor');
  box(scene,[.28,3.0,18.7],[-5.22,1.5,1.58],M.wall,'outer-left');
  box(scene,[.28,3.0,18.7],[5.22,1.5,1.58],M.wall,'outer-right');
  box(scene,[10.7,3.0,.28],[0,1.5,-7.52],M.wall,'outer-rear');
  // front wall leaves an actual entrance gap
  box(scene,[4.05,3,.28],[-3.27,1.5,10.72],M.wall,'front-left');
  box(scene,[4.05,3,.28],[3.27,1.5,10.72],M.wall,'front-right');
  box(scene,[10.7,.18,7.0],[0,2.68,7.18],M.dark,'low-ceiling');
  box(scene,[10.7,.16,11.2],[0,2.92,-2.0],M.dark,'rear-ceiling');

  // asymmetrical corridor walls
  for(const [i,r] of wallSegments.entries())box(scene,[r.x2-r.x1,2.7,r.z2-r.z1],[(r.x1+r.x2)/2,1.35,(r.z1+r.z2)/2],i%3===0?M.steel:M.wall,`partition-${i}`);

  // door frames and patched lintels, intentionally mismatched
  const frames=[[-1.7,5.25,1],[1.7,4.3,-1],[-1.7,-1.45,1],[1.7,-3.35,-1]];
  frames.forEach(([x,z,side],i)=>{box(scene,[.18,2.35,.18],[x,1.18,z-1.02],M.steel);box(scene,[.18,2.35,.18],[x,1.18,z+1.02],M.steel);box(scene,[.22,.18,2.22],[x,2.28,z],i%2?M.wood:M.steel);});

  // reception: high counter, ledger slit, old bell, different from all other rooms
  box(scene,[2.4,1.08,1.45],[-3.76,.54,7.43],M.wood,'reception-counter');
  box(scene,[2.15,.08,1.25],[-3.76,1.11,7.43],M.dark);
  box(scene,[.9,.035,.58],[-3.88,1.18,7.28],M.paper,'ledger-target',-.07);
  cyl(scene,.095,.08,[-2.9,1.2,7.25],[0,0,0],M.steel,16);
  for(let i=0;i<14;i++)box(scene,[.075,1.45,.055],[-5.02,1.05,5.0+i*.25],M.steel);

  // document room: desk is cleanest object in the whole building, but cables ruin it
  box(scene,[2.35,.77,1.22],[3.7,.385,5.93],M.dark,'document-desk');
  box(scene,[.58,.48,.18],[3.75,1.12,5.42],M.black,'terminal-body');
  plane(scene,[.48,.34],[3.75,1.13,5.32],[0,0,0],M.screen,'terminal-target');
  for(let i=0;i<7;i++){const x=2.25+i*.44;box(scene,[.32,.035,.47],[x,1.0,6.27+(i%2)*.055],M.paper,'paper-stack',-.12+i*.035);}
  // hanging cable drops instead of decorative perfect arcs
  for(const [x,z,h] of [[2.45,8.8,2.5],[3.35,8.2,2.2],[4.55,7.8,2.48]]){cyl(scene,.018,h,[x,2.74-h/2,z],[0,0,0],M.black,6);}

  // workshop: dense, low, dirty, physically different furniture
  for(let i=0;i<4;i++)box(scene,[.82,.09,3.2],[-4.42, .43+i*.48,1.62],i===2?M.steel:M.wood,`tool-shelf-${i}`);
  box(scene,[1.3,.92,1.4],[-2.85,.46,1.05],M.steel,'work-block');
  box(scene,[1.18,.08,1.18],[-2.85,.96,1.05],M.wood);
  for(let i=0;i<11;i++){const x=-4.78+(i%3)*.34,z=2.66-Math.floor(i/3)*.48;box(scene,[.18,.18,.24],[x,.7+((i*7)%4)*.27,z],i%4===0?M.paper:M.steel);}
  // overhead pipes cross rooms at inconsistent heights
  const pipeRuns=[[-4.55,2.42,3.45,3.0],[-3.85,2.58,.3,5.2],[-2.25,2.35,2.0,3.8]];
  pipeRuns.forEach(([x,y,z,len],i)=>cyl(scene,.055,len,[x,y,z],[Math.PI/2,0,0],i===1?M.steel:M.dark,8));

  // inspection room: long bench and a deliberately ugly fluorescent fixture
  box(scene,[2.2,.82,1.1],[3.65,.41,-1.08],M.steel,'inspection-bench');
  for(let i=0;i<5;i++)box(scene,[.28,.18,.28],[2.85+i*.4,.94,-1.05],i%2?M.paper:M.dark);
  const fluorescent=new THREE.MeshStandardMaterial({color:0xe1e6c8,emissive:0xcbd8ad,emissiveIntensity:1.8,roughness:.55});
  box(scene,[1.55,.055,.12],[3.45,2.55,-.4],fluorescent,'flicker-fixture',.03);

  // archive: compressed shelving, labels, no symmetrical museum presentation
  for(const z of [-5.95,-5.25,-4.55,-3.85]){
    box(scene,[1.15,2.2,.17],[-4.35,1.1,z],M.steel,'archive-shelf');
    for(let level=0;level<4;level++)for(let j=0;j<3;j++){
      const w=.22+(j===1?.08:0);box(scene,[w,.22,.42],[-4.72+j*.37,.28+level*.48,z+.03],(j+level)%3===0?M.paper:M.dark,'archive-box',(j-1)*.05);
    }
  }
  box(scene,[1.05,.95,1.5],[-2.87,.475,-5.05],M.wood,'archive-table');
  const archiveCard=box(scene,[.56,.035,.72],[-2.9,.98,-5.02],M.paper,'archive-target',.09);

  // sealed room: visually tempting but not enterable; gridded gate and one warning plate
  box(scene,[2.25,1.0,1.25],[3.68,.5,-5.82],M.dark,'sealed-crates');
  for(let i=0;i<9;i++)box(scene,[.055,2.45,.055],[2.1+i*.38,1.23,-4.86],M.steel,'sealed-bars');
  const warnMap=noticeTexture(['閉鎖','未整理物を移動しない','開封記録が無い箱は触れない','持出しは台帳を先に書く']);
  const warnMat=new THREE.MeshBasicMaterial({map:warnMap,side:THREE.DoubleSide});
  plane(scene,[.76,1.02],[4.63,1.35,-6.88],[0,-Math.PI/2,0],warnMat,'sealed-target');

  // signs: typography belongs to the architecture, not a floating game HUD
  const signMat=new THREE.MeshBasicMaterial({map:signTexture('祭祀技師事務所','記録／道具／書類'),side:THREE.DoubleSide});
  plane(scene,[2.65,.99],[0,2.08,10.55],[0,0,0],signMat,'office-sign');
  const roomSigns=[['受付','記録を先に',-1.93,5.3,Math.PI/2],['書類机','口約束にしない',1.93,4.28,-Math.PI/2],['作業場','触る前に見る',-1.93,-1.45,Math.PI/2],['検品','持出し前に照合',1.93,-3.35,-Math.PI/2]];
  roomSigns.forEach(([t,s,x,z,ry])=>{const sm=new THREE.MeshBasicMaterial({map:signTexture(t,s,'#c9c1a6','#272820','#7a5a3c'),side:THREE.DoubleSide});const m=plane(scene,[1.08,.405],[x,2.03,z],[0,ry,0],sm);m.renderOrder=2;});

  // wall notices are uneven, some partly hidden behind furniture
  const notices=[
    {p:[-5.05,1.55,8.85],r:[0,Math.PI/2,0],l:['受付','名前より先に要件を書く','個人情報は必要な分だけ','急ぎほど日付を残す']},
    {p:[5.05,1.45,1.15],r:[0,-Math.PI/2,0],l:['作業後','火気／刃物／薬品を確認','借用品を戻す','異常は隠さず書く']},
    {p:[-.02,1.56,-7.35],r:[0,0,0],l:['奥扉','この先は公開空間ではない','記録だけを残す','戸締りを確認する']}
  ];
  notices.forEach(n=>{const mm=new THREE.MeshBasicMaterial({map:noticeTexture(n.l),side:THREE.DoubleSide});plane(scene,[.74,.99],n.p,n.r,mm);});

  // exposed meters, ducts, brackets and conduit. Density increases toward the rear.
  for(let i=0;i<14;i++){
    const side=i%2?-1:1,x=side*5.02,z=9.4-i*1.15,y=1.55+((i*13)%5)*.19;
    box(scene,[.1,.34,.44],[x,y,z],M.steel,'meter',0);
    cyl(scene,.025,.7,[x-side*.11,y-.35,z],[0,0,0],M.dark,6);
  }
  for(const z of [8.1,2.15,-4.0])box(scene,[10.1,.22,.42],[0,2.62,z],M.steel,'duct',z<0?.03:-.02);
  for(let i=0;i<8;i++)box(scene,[.08,.16,.36],[-5.0+i*1.35,2.45,8.1],M.dark,'duct-bracket');

  // interaction targets. Text is conservative: links expose existing public sections only.
  const targets=[
    {id:'ledger',mesh:scene.getObjectByName('ledger-target'),label:'受付台帳',text:'受付台帳。公開作品の記録へ移る。',href:'../works/'},
    {id:'terminal',mesh:scene.getObjectByName('terminal-target'),label:'記録端末',text:'公開中の研究ページを開く。',href:'../research/'},
    {id:'archive',mesh:archiveCard,label:'保管目録',text:'公開アーカイブへ移る。',href:'../archive/'},
    {id:'sealed',mesh:scene.getObjectByName('sealed-target'),label:'閉鎖札',text:'未整理。ここから先には入れない。'},
    {id:'exit',mesh:scene.getObjectByName('office-sign'),label:'表へ戻る',text:'不氣屋アーケードへ戻る。',href:'../arcade/'}
  ];
  for(const t of targets)t.position=t.mesh.getWorldPosition(new THREE.Vector3());

  return {targets,rooms:ROOMS,flickerMaterials:[fluorescent]};
}
