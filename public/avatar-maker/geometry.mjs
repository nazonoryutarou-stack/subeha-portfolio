/* Procedural stylized human with an actual humanoid skeleton.
 * Independent mesh/rig implementation; no VRoid app meshes or proprietary textures. */
import * as THREE from 'three';
import {normalizeAvatar} from './model.mjs';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const material=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.87,metalness:0,...opts});
const sphere=(parent,name,xyz,scale,mat,detail=18)=>{
 const geo=new THREE.SphereGeometry(1,detail,Math.max(8,Math.floor(detail*.72)));
 geo.scale(...scale);
 const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(...xyz);
 parent.add(mesh);return mesh;
};
function curve(parent,name,points,radius,mat){
 const path=new THREE.CatmullRomCurve3(points.map(x=>V(...x)));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(8,points.length*4),radius,5,false),mat);
 mesh.name=name;parent.add(mesh);return mesh;
}
function tubeSegment(a,b,ra,rb=ra){
 const direction=new THREE.Vector3().subVectors(b,a),length=direction.length();
 const g=new THREE.CylinderGeometry(rb,ra,length,14,2);
 const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),direction.normalize());
 g.applyQuaternion(q);g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
 return g;
}
function morphSphere(parent,name,origin,radii,mat,defs){
 const geo=new THREE.SphereGeometry(1,24,16),attr=geo.attributes.position;
 geo.scale(...radii);
 const orig=geo.attributes.position.array,targets=[];
 for(const params of defs){
  const data=new Float32Array(orig.length);
  for(let i=0;i<orig.length;i+=3){
   const x=orig[i],y=orig[i+1],z=orig[i+2];
   data[i]=x*(params.sx??1);data[i+1]=y*(params.sy??1)+(params.dy||0);data[i+2]=z*(params.sz??1);
  }
  targets.push(new THREE.Float32BufferAttribute(data,3));
 }
 geo.morphAttributes.position=targets;
 const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(...origin);parent.add(m);
 m.morphTargetDictionary=Object.fromEntries(defs.map((p,i)=>[p.name,i]));
 m.morphTargetInfluences=new Array(defs.length).fill(0);
 return m;
}
export function buildAvatar(input){
 const p=normalizeAvatar(input),root=new THREE.Group();root.name='Avatar_Atelier_Root';
 const H=p.bodyHeight,leg=p.legLength,arm=p.armLength;
 const positions={
  hips:V(0,.98*leg*H,0),
  spine:V(0,(.98*leg+.18)*H,0),
  chest:V(0,(.98*leg+.38)*H,0),
  upperChest:V(0,(.98*leg+.49)*H,0),
  neck:V(0,(.98*leg+.59)*H,0),
  head:V(0,(.98*leg+.78)*H,0)
 };
 const shoulderX=.245*p.shoulderWidth*H, armElbow=(shoulderX+.29*arm*H),armWrist=(armElbow+.235*arm*H);
 for(const [side,sign] of [['left',1],['right',-1]]){
  positions[side+'Shoulder']=V(sign*shoulderX,(.98*leg+.47)*H,0);
  positions[side+'UpperArm']=V(sign*(shoulderX+.055*H),(.98*leg+.46)*H,0);
  positions[side+'LowerArm']=V(sign*armElbow,(.98*leg+.44)*H,-.005);
  positions[side+'Hand']=V(sign*armWrist,(.98*leg+.41)*H,.015);
  positions[side+'UpperLeg']=V(sign*.117*p.waistWidth*H,.94*leg*H,0);
  positions[side+'LowerLeg']=V(sign*.125*p.waistWidth*H,.49*leg*H,.012);
  positions[side+'Foot']=V(sign*.13*p.waistWidth*H,.10*leg*H,.055);
 }
 const relations={
  hips:null,spine:'hips',chest:'spine',upperChest:'chest',neck:'upperChest',head:'neck',
  leftShoulder:'upperChest',leftUpperArm:'leftShoulder',leftLowerArm:'leftUpperArm',leftHand:'leftLowerArm',
  rightShoulder:'upperChest',rightUpperArm:'rightShoulder',rightLowerArm:'rightUpperArm',rightHand:'rightLowerArm',
  leftUpperLeg:'hips',leftLowerLeg:'leftUpperLeg',leftFoot:'leftLowerLeg',
  rightUpperLeg:'hips',rightLowerLeg:'rightUpperLeg',rightFoot:'rightLowerLeg'
 };
 const bones={},boneKeys=Object.keys(relations);
 for(const key of boneKeys){
  const bone=new THREE.Bone();bone.name='Human_'+key;
  const parent=relations[key],at=positions[key],parentAt=parent?positions[parent]:V(0,0,0);
  bone.position.copy(at).sub(parentAt);
  if(parent)bones[parent].add(bone);else root.add(bone);
  bones[key]=bone;
 }
 root.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(boneKeys.map(k=>bones[k]));
 const skin=material(p.skinColor),top=material(p.topColor),bottom=material(p.bottomColor),shoes=material(p.shoeColor);
 const shade=material(new THREE.Color(p.skinColor).multiplyScalar(.87)),hair=material(p.hairColor,{roughness:.8}),
  iris=material(p.eyeColor,{metalness:.07,roughness:.45}),black=material('#14141e'),white=material('#fffaf6'),pink=material('#8c4d54');
 const accent=material(p.accentColor,{metalness:.22,roughness:.43});
 const skinIndex=name=>boneKeys.indexOf(name);
 function skinned(name,geometry,mat,joint){
  const g=geometry,count=g.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
  const index=skinIndex(joint);
  for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(g,mat);mesh.name=name;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton);
  return mesh;
 }
 function weightedBall(name,pos,scale,mat,joint){
  const geo=new THREE.SphereGeometry(1,16,12);
  geo.scale(...scale);geo.translate(...pos);
  return skinned(name,geo,mat,joint);
 }
 function weightedSegment(name,from,to,r1,r2,mat,joint){
  return skinned(name,tubeSegment(positions[from],positions[to],r1,r2),mat,joint);
 }
 // Torso uses separate skin-bound volumes, so the rig remains editable in any VRM editor.
 const pelvisY=positions.hips.y,shoulderY=positions.chest.y;
 weightedBall('Skin_Pelvis',[0,pelvisY,.002],[.165*p.waistWidth*H,.14*H,.095*p.torsoWidth*H],skin,'hips');
 weightedBall('Skin_Torso',[0,(pelvisY+shoulderY)/2,0],[.20*p.shoulderWidth*H,(shoulderY-pelvisY)*.62,.115*p.torsoWidth*H],skin,'spine');
 weightedBall('Clothes_Top',[0,(pelvisY+positions.upperChest.y)/2,.001],[.215*p.shoulderWidth*H,(positions.upperChest.y-pelvisY)*.57*p.hemLength,.124*p.torsoWidth*H],top,'spine');
 weightedSegment('Skin_Neck','neck','head',.055*H,.062*H,skin,'neck');
 for(const side of ['left','right']){
  weightedSegment('Skin_'+side+'_UpperArm',side+'UpperArm',side+'LowerArm',.060*H,.052*H,skin,side+'UpperArm');
  weightedSegment('Skin_'+side+'_LowerArm',side+'LowerArm',side+'Hand',.045*H,.035*H,skin,side+'LowerArm');
  weightedBall('Skin_'+side+'_Palm',[positions[side+'Hand'].x+(side==='left'?1:-1)*.025*H,positions[side+'Hand'].y,.012],[.06*H,.036*H,.022*H],skin,side+'Hand');
  for(let f=0;f<4;f++){
   const center=positions[side+'Hand'],sign=side==='left'?1:-1;
   const geo=tubeSegment(V(center.x+sign*.05*H,center.y+(f-1.5)*.014*H,.02),
     V(center.x+sign*(.077+Math.max(0,2-Math.abs(1.5-f))*.006)*H,center.y+(f-1.5)*.015*H,.02),.009*H);
   skinned('Finger_'+side+'_'+f,geo,skin,side+'Hand');
  }
  weightedSegment('Skin_'+side+'_Thigh',side+'UpperLeg',side+'LowerLeg',.098*p.waistWidth*H,.073*H,skin,side+'UpperLeg');
  weightedSegment('Skin_'+side+'_Shin',side+'LowerLeg',side+'Foot',.068*H,.042*H,skin,side+'LowerLeg');
  const foot=positions[side+'Foot'];
  weightedBall('Footwear_'+side,[foot.x,foot.y-.01*H,foot.z+.07*H],[.076*H,.062*H,.146*H],shoes,side+'Foot');
  if(p.bottomStyle!=='skirt'&&p.topStyle!=='dress'){
   weightedSegment('Clothes_Pants_Upper_'+side,side+'UpperLeg',side+'LowerLeg',.112*p.waistWidth*H,.077*H,bottom,side+'UpperLeg');
   if(p.bottomStyle==='pants')weightedSegment('Clothes_Pants_Lower_'+side,side+'LowerLeg',side+'Foot',.082*H,.048*H,bottom,side+'LowerLeg');
  }
  const sleeves=p.sleeveLength*.28;
  weightedBall('Clothes_Sleeve_'+side,[(positions[side+'UpperArm'].x+positions[side+'LowerArm'].x)/2,positions[side+'UpperArm'].y,.0],[Math.max(.085,sleeves)*H,.077*H,.077*H],top,side+'UpperArm');
 }
 if(p.topStyle==='dress'||p.bottomStyle==='skirt'){
  const skirtMat=p.topStyle==='dress'?top:bottom;
  const geo=new THREE.CylinderGeometry(.152*p.waistWidth*H,.33*p.waistWidth*H,.39*p.hemLength*H,24,3,false);
  geo.translate(0,pelvisY-.145*H,0);
  skinned('Clothes_Skirt',geo,skirtMat,'hips');
 }
 if(p.collarHeight>.05){
  weightedBall('Clothes_Collar',[0,positions.neck.y-.062*H,.10*H],[.082*H,.029*p.collarHeight*H,.032*H],p.topStyle==='jacket'?accent:top,'upperChest');
 }
 if(p.topStyle==='hoodie'){
  weightedBall('Clothes_Hood',[0,positions.neck.y-.02*H,-.098*H],[.13*H,.155*H,.10*H],top,'upperChest');
  weightedSegment('Hood_Lace_Left','neck','chest',.005*H,.005*H,white,'upperChest');
 }
 if(p.topStyle==='jacket'){
  const stripe=material(p.accentColor);
  weightedBall('Clothes_Jacket_Collar',[0,positions.neck.y-.09*H,.12*H],[.07*H,.09*H,.018*H],stripe,'upperChest');
 }
 // Rigged head geometry, independent of the shape of the hair.
 const head=bones.head,headS=p.headSize*H,rx=.205*p.faceWidth*headS,ry=.248*p.faceLength*headS,rz=.174*headS;
 sphere(head,'Head', [0,0,0],[rx,ry,rz],skin,32);
 sphere(head,'Jaw',[0,-.125*headS,.048*headS],[rx*.76,ry*.52,rz*.87],skin,26);
 for(const sign of [-1,1]){
  sphere(head,'Ear_'+sign,[sign*(rx+.015*headS),-.018*headS,-.008*headS],[.038*p.earSize*headS,.072*p.earSize*headS,.035*headS],skin);
  sphere(head,'Ear_inner_'+sign,[sign*(rx+.039*headS),-.019*headS,.017*headS],[.019*p.earSize*headS,.047*p.earSize*headS,.01*headS],shade,12);
 }
 const eyeMeshes=[],mouthMeshes=[];
 const eyeX=.092*p.eyeSpacing*headS,eyeY=.021*headS,eyeZ=rz*.85;
 for(const sign of [-1,1]){
  const eyePos=[sign*eyeX,eyeY,eyeZ],eyeW=.067*p.eyeSize*headS,eyeH=(p.eyeStyle==='sharp'?.048:p.eyeStyle==='sleepy'?.043:.059)*p.eyeSize*headS;
  const eye=morphSphere(head,'Eyes_'+(sign<0?'Right':'Left'),eyePos,[eyeW,eyeH,.027*headS],white,
   [{name:'blink',sx:1,sy:.07,sz:1},{name:'happy',sx:.9,sy:.50,sz:1},{name:'sad',sx:1,sy:.8,sz:1}]);
  eye.rotation.z=sign*p.eyeTilt*.3;eyeMeshes.push(eye);
  sphere(head,'Iris_'+sign,[sign*eyeX,eyeY,eyeZ+.026*headS],[eyeW*.53,eyeH*.86,.012*headS],iris);
  sphere(head,'Pupil_'+sign,[sign*eyeX,eyeY,eyeZ+.039*headS],[eyeW*.27,eyeH*.56,.009*headS],black);
  sphere(head,'Eye_shine_'+sign,[sign*eyeX-eyeW*.16,eyeY+eyeH*.20,eyeZ+.050*headS],[eyeW*.17,eyeH*.23,.006*headS],white,10);
  curve(head,'Upper_Eyelash_'+sign,[
   [sign*(eyeX-eyeW*1.0),eyeY+eyeH*.68,eyeZ+.029*headS],
   [sign*eyeX,eyeY+eyeH*1.04,eyeZ+.033*headS],
   [sign*(eyeX+eyeW*1.07),eyeY+eyeH*.57,eyeZ+.025*headS]
  ],.006*headS,black);
  const browY=eyeY+.104*headS;
  curve(head,'Brow_'+sign,[
   [sign*(eyeX-eyeW*.84),browY-sign*p.eyebrowTilt*.035*headS,eyeZ+.008*headS],
   [sign*eyeX,browY+.010*headS,eyeZ+.014*headS],
   [sign*(eyeX+eyeW*.84),browY+sign*p.eyebrowTilt*.035*headS,eyeZ+.008*headS]
  ],.009*headS,hair);
  sphere(head,'Cheek_'+sign,[sign*.115*headS,-.084*headS,rz*.78],[.050*headS,.024*headS,.012*headS],material('#de9e9f',{transparent:true,opacity:.24,depthWrite:false}));
 }
 sphere(head,'Nose',[0,-.074*headS,rz*.96],[.019*p.noseSize*headS,.019*p.noseSize*headS,.018*headS],skin);
 const mouth=morphSphere(head,'Mouth',[0,-.146*headS,rz*.90],
  [.047*p.mouthWidth*headS,.008*headS,.008*headS],pink,[
   {name:'aa',sx:1,sy:4.3,sz:1},{name:'ih',sx:1.65,sy:2.5,sz:1},
   {name:'ou',sx:.66,sy:3.6,sz:1},{name:'ee',sx:1.55,sy:1.8,sz:1},
   {name:'oh',sx:.95,sy:3.9,sz:1},{name:'happy',sx:1.4,sy:1,sz:1},
   {name:'sad',sx:.9,sy:1.3,sz:1},{name:'angry',sx:.8,sy:.7,sz:1},
   {name:'surprised',sx:.83,sy:3.7,sz:1},{name:'relaxed',sx:1.1,sy:1,sz:1}
  ]);
 // Lift the mouth corners, without altering the exported expression targets.
 // The same deformation is applied to every morph target for predictable smiles.
 if(Math.abs(p.mouthSmile)>.001){
  const g=mouth.geometry,base=g.attributes.position;
  const width=.047*p.mouthWidth*headS||1;
  const tweak=(attr)=>{
   for(let j=0;j<attr.count;j++){
    const x=attr.getX(j),y=attr.getY(j);
    const lift=Math.pow(Math.abs(x)/width,1.7)*p.mouthSmile*.019*headS;
    attr.setY(j,y+lift);
   }
   attr.needsUpdate=true;
  };
  tweak(base);
  for(const attr of g.morphAttributes.position)tweak(attr);
  g.computeVertexNormals();
 }
 mouthMeshes.push(mouth);
 // Hair: scalp cap, hair panels and guide-strand curves move with the head bone.
 const hairS=p.hairVolume,brx=rx*1.11*hairS,bry=ry*1.09,brz=rz*1.09*hairS;
 const cap=new THREE.Mesh(new THREE.SphereGeometry(1,28,15,0,2*Math.PI,0,Math.PI*.52),hair);
 cap.name='Hair_Scalp';cap.scale.set(brx,bry,brz);cap.position.y=.02*headS;head.add(cap);
 const hasLong=['long','ponytail','twintails'].includes(p.hairStyle);
 const hasBob=p.hairStyle==='bob';
 const length=(hasLong?.53:hasBob?.32:.13)*p.hairLength*headS/.27;
 for(const sign of [-1,1]){
  const count=p.hairStyle==='short'?5:9;
  for(let i=0;i<count;i++){
   const theta=(i/count)*Math.PI*.80+.10;
   const x=sign*(brx*.75+Math.sin(theta)*brx*.30),z=Math.cos(theta)*brz*.35-brz*.40;
   const yy=brx*.24;
   curve(head,'Hair_Side_'+sign+'_'+i,[
    [x*.73,ry*.65,-.0],[x,yy*.62,z],[x*1.05+p.hairWaves*Math.sin(i*1.3)*.06*headS,-length*.47,z-.012],[x*.90+p.hairWaves*Math.sin(i*2.1)*.09*headS,-length,z+.02*Math.sin(i*2)]
   ],(.018+.004*hairS)*headS,hair);
  }
 }
 const bangsCount=p.hairPart==='straight'?13:10;
 for(let i=0;i<bangsCount;i++){
  const t=i/(bangsCount-1),x=(t*2-1)*brx*.92;
  const side=p.hairPart==='side'?x*.37:0;
  const endY=(.052-(.11*p.bangLength))*headS+(p.hairPart==='center'?Math.abs(x)*.45:0);
  curve(head,'Hair_Bang_'+i,[
   [x*.58,ry*.93,brz*.17],
   [x*.93,ry*.62,brz*.64],
   [x+side+p.hairWaves*Math.sin(i*3)*.02*headS,Math.max(0,endY+.11*headS),brz*.91],
   [x+side*1.5+p.hairWaves*Math.cos(i*2)*.035*headS,endY,brz*.92]
  ],(.021+.006*p.hairVolume)*headS,hair);
 }
 if(p.hairStyle==='ponytail'){
  sphere(head,'Pony_Knot',[0,.085*headS,-brz],[.11*headS,.10*headS,.11*headS],accent);
  for(let i=0;i<16;i++){
   const a=i/16*Math.PI*2;
   curve(head,'Pony_tail_'+i,[
    [0,.08*headS,-brz],[Math.cos(a)*.08*headS,-.14*headS,-brz-.10*headS],
    [Math.cos(a)*.16*headS,-length,-brz-.22*headS]
   ],.018*headS,hair);
  }
 }
 if(p.hairStyle==='twintails'){
  for(const sign of [-1,1]){
   const x=sign*brx*.88;
   sphere(head,'Tie_'+sign,[x,.12*headS,-.065*headS],[.051*headS,.048*headS,.047*headS],accent);
   for(let i=0;i<12;i++){
    const phi=i/12*Math.PI*2;
    curve(head,'Twin_'+sign+'_'+i,[
     [x,.12*headS,-.06*headS],
     [x+sign*.105*headS,-.09*headS,-.05*headS],
     [x+sign*(.07+.035*Math.cos(phi))*headS,-length*.95,-.05*headS+.07*Math.sin(phi)*headS]
    ],.02*headS,hair);
   }
  }
 }
 if(p.accessory==='glasses'){
  for(const sign of [-1,1]){
   const m=new THREE.Mesh(new THREE.TorusGeometry(.085*headS,.009*headS,8,32),black);
   m.name='Glasses_'+sign;m.position.set(sign*eyeX,eyeY,eyeZ+.06*headS);
   m.scale.set(1.1,.8,1);head.add(m);
  }
  curve(head,'Glasses_Bridge',[[-eyeX*.45,eyeY+.015*headS,eyeZ+.065*headS],[0,eyeY+.018*headS,eyeZ+.08*headS],[eyeX*.45,eyeY+.015*headS,eyeZ+.065*headS]],.006*headS,black);
 }
 if(p.accessory==='catEars'){
  for(const sign of [-1,1]){
   const ear=new THREE.Mesh(new THREE.ConeGeometry(.075*headS,.15*headS,3),hair);
   ear.position.set(sign*rx*.69,ry*.93,0);
   ear.rotation.z=-sign*.19;ear.name='CatEar_'+sign;head.add(ear);
  }
 }
 if(p.accessory==='headphones'){
  const arch=new THREE.Mesh(new THREE.TorusGeometry(.245*headS,.028*headS,8,48,Math.PI),accent);
  arch.name='Headphones_Arch';arch.rotation.z=0;arch.position.y=.05*headS;head.add(arch);
  for(const sign of [-1,1])sphere(head,'Headphones_Pad_'+sign,[sign*(rx+.05*headS),0,0],[.04*headS,.11*headS,.085*headS],black);
 }
 // Full rig list and morph target nodes are exported alongside geometry.
 root.updateMatrixWorld(true);
 return {root,bones,skeleton,p,eyeMeshes,mouthMeshes,boneNames:boneKeys};
}
export function posePreview(avatar,time=0,expression='neutral',movement='idle'){
 if(!avatar)return;
 const {bones,eyeMeshes,mouthMeshes}=avatar;
 for(const name of Object.keys(bones))bones[name].rotation.set(0,0,0);
 const t=time;
 bones.spine.rotation.x=Math.sin(t*2.5)*.016;
 bones.head.rotation.y=Math.sin(t*.6)*.033;
 if(movement==='wave'){
  bones.rightUpperArm.rotation.z=.55;
  bones.rightLowerArm.rotation.z=-.7+Math.sin(t*6)*.22;
 }
 if(movement==='nod')bones.head.rotation.x=Math.sin(t*4)*.23;
 if(movement==='bow')bones.spine.rotation.x=.28+Math.sin(t*2)*.045;
 for(const eye of eyeMeshes){
  const morph=eye.morphTargetDictionary;
  eye.morphTargetInfluences.fill(0);
  if(expression==='blink')eye.morphTargetInfluences[morph.blink]=1;
  else if(['happy','sad'].includes(expression))eye.morphTargetInfluences[morph[expression]]=1;
  else if(Math.pow(Math.max(0,Math.sin(t*1.95+.4)),36)>.45)eye.morphTargetInfluences[morph.blink]=1;
 }
 for(const mouth of mouthMeshes){
  mouth.morphTargetInfluences.fill(0);
  const index=mouth.morphTargetDictionary[expression];
  if(index!==undefined)mouth.morphTargetInfluences[index]=1;
 }
}
export function disposeAvatar(avatar){
 if(!avatar)return;const geometries=new Set(),materials=new Set();
 avatar.root.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material]))if(mat)materials.add(mat);});
 for(const g of geometries)g.dispose();for(const mat of materials)mat.dispose();
}
