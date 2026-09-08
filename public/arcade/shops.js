import * as THREE from './vendor/three.module.min.js';
import { readingCard, sign } from './surfaces.js';

// Each shop is authored independently. Only joinery, utilities and primitives are shared.
export function buildShops(a) {
  const {m,box,cylinder,sphere,panel,label,shadow,cable,pipe,tube,fan,utility,room,front,target,desk,shelf,paint}=a;

  // 01 — 妹字屋. Older timber inserted under the concrete arcade.
  const imoji=room('imoji','妹字屋',-1,16,6.2,4.3,2.74,m.blackwood,m.wood), p=imoji.group;
  front(imoji,-.95,1.52,2.15,m.blackwood);
  for(const x of [-3.02,-1.76,-.15,1.3,3.02])box(p,x,1.31,-.12,.12,2.62,.16,m.wood);
  box(p,0,2.26,-.14,6.15,.15,.22,m.wood);
  // The sliding leaf is parked alongside the clear doorway, on its original rail.
  box(p,0,2.19,-.18,4.25,.045,.05,m.brass);
  box(p,.57,1.07,.1,1.38,2.1,.075,m.wood,true);
  for(let x=0;x<1.22;x+=.14)box(p,x,1.30,-.01,.026,1.42,.028,m.brass);
  box(p,.01,1.11,-.04,.03,.16,.04,m.brass);
  const canopy=box(p,0,2.47,-.48,6.05,.07,.93,m.rust);canopy.rotation.x=-.06;
  for(let x=-2.7;x<3;x+=.8)box(p,x,2.43,-.52,.035,.05,.98,m.metal);
  for(const x of [-2.2,2.2])box(p,x,2.92,-.21,.055,.08,.42,m.rust);
  box(p,0,2.94,-.38,4.9,.70,.14,m.blackwood);
  label(p,0,2.94,-.462,4.65,.58,'妹字屋',{bg:'#222119',fg:'#c5a361'});
  // Small perpendicular blade sign. The other side is only the old painted board.
  box(p,2.46,2.01,-.70,.14,1.24,.78,m.rust);
  label(p,2.37,2.01,-.7,.65,1.08,'妹字',{bg:'#615643',fg:'#b8a987',vertical:true},-Math.PI/2);
  tube(p,-1.18,2.35,-.22,.49,0xbda779);
  box(p,1.99,1.11,-.105,1.4,1.5,.12,m.black);
  for(let x=1.32;x<2.68;x+=.17)box(p,x,1.14,-.19,.03,1.46,.04,m.wood);
  label(p,-2.44,1.59,-.21,.4,.57,'妹字',{bg:'#b9ad8b',fg:'#403224',vertical:true});
  label(p,2.76,.85,-.2,.28,.46,'読めます',{bg:'#23221a',fg:'#c6ae76',vertical:true});
  utility(p,-2.91,1.98,-.2,1);
  pipe(p,[[-2.92,2.5,-.3],[-2.9,.2,-.3],[-2.4,.2,-.5]],.045,m.rust);
  box(p,-2.42,.06,-.46,.4,.1,.36,m.metal);
  cable(p,[[-3,2.83,-.2],[-1.8,2.67,-.39],[.85,2.67,-.4],[2.8,3.14,-.13]],0x22231c);
  desk(p,-1.18,2.54,1.7,.76,m.wood);
  box(p,-1.18,.87,2.54,.54,.055,.45,m.blackwood);
  const ledger=label(p,-1.18,1.035,2.44,.55,.5,'暗号台帳',{bg:'#16150f',fg:'#c4a565'});ledger.rotation.x=.68;
  target(ledger,'imoji-ledger','暗号台帳を開く',{href:'../imoji-lab/app.html'});
  shelf(p,1.6,3.92,1.77,2.10,.36);
  for(let j=0;j<3;j++)for(let i=0;i<5;i++){
    box(p,.91+i*.33,.4+j*.56,3.92,.20,.26,.2,m.blackwood);
    if((i+j)%2===0)panel(p,.91+i*.33,.43+j*.56,3.8,.12,.17,readingCard());
  }
  const card=panel(p,1.45,1.6,2.94,.43,.59,readingCard());
  cable(p,[[1.45,2.72,2.94],[1.46,2.1,2.94],[1.45,1.91,2.94]],0x524936,.007);
  let read=false;target(card,'reading-card','読み札を裏返す',{text:'読める。意味は、まだ読めない。',onUse:()=>{read=!read;card.material.map=readingCard(read);}});
  label(p,-2.92,1.35,2.5,.5,.65,'黒和紙',{bg:'#13130e',fg:'#b89958',vertical:true},Math.PI/2);
  tube(p,-.8,2.5,2.24,.66,0xd7bb7c);
  shadow(p,0,.18,5.9,1.0);fan(p,2.61,2.27,4.08,.34);

  // 02 — しきがみ上手. A shallow postwar aluminium/glass shop under a lean-to.
  const shiki=room('shikigami','しきがみ上手',1,11.7,5.6,3.25,2.98,m.plaster,m.floor),s=shiki.group;
  const glass=new THREE.MeshLambertMaterial({color:0x9cae91,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide});
  box(s,1.18,.39,0,3.14,.78,.15,m.tile,true);box(s,-2.42,1.48,0,.75,2.96,.16,m.plaster,true);
  for(const x of [-2.07,-.53,1.3,2.72])box(s,x,1.42,-.06,.055,2.82,.09,m.metal,true);
  box(s,.76,2.73,0,4.1,.4,.14,m.plaster);
  for(const x of [.35,2.03]){
    box(s,x,1.7,0,1.57,1.7,.026,glass,true);
    box(s,x,1.85,-.03,1.62,.035,.04,m.metal);
  }
  // Open sliding pane remains visible, offset inside instead of blocking the entrance.
  box(s,-.37,1.17,.28,.9,2.33,.025,glass,true);
  for(const x of [-.82,.08])box(s,x,1.16,.27,.025,2.33,.035,m.metal);
  const shikiRoof=box(s,.1,3.08,-.48,5.95,.055,1.04,m.roof);shikiRoof.rotation.x=-.18;
  for(let x=-2.8;x<3;x+=.35)box(s,x,3.09,-.45,.025,.04,1.02,m.metal);
  box(s,.75,2.5,-.15,3.77,.38,.10,m.cream);
  label(s,.75,2.5,-.212,3.6,.3,'しきがみ上手',{bg:'#c0baa0',fg:'#425345',faded:true});
  label(s,-2.38,1.35,-.12,.42,.65,'種＋紙',{bg:'#647264',fg:'#d6d0b4',vertical:true});
  desk(s,.65,2.6,2.96,.65,m.cream);shelf(s,2.35,1.24,.58,1.3,.5);
  // Ordinary seed pots and folded paper, as specified in the existing brand page.
  for(let i=0;i<5;i++){
    const x=-.3+i*.47;
    cylinder(s,x,.96,2.6,.12,.26,paint(i%2?0x755845:0xaaa485));
    cylinder(s,x,1.094,2.6,.11,.012,paint(0x302b1e));
    const stem=cylinder(s,x,1.25,2.6,.009,.33,paint(0x65754d));stem.rotation.z=(i-2)*.07;
    for(const d of [-1,1]){const leaf=sphere(s,x+d*.055,1.3,2.6,.07,paint(0x6e7e55));leaf.scale.set(.09,.018,.04);leaf.rotation.z=d*.42;}
    const paper=box(s,x+.19,.9,2.62,.18,.025,.14,m.paper);paper.rotation.z=.5;paper.rotation.y=.3;
    box(s,x+.21,.96,2.62,.05,.12,.09,m.paper).rotation.z=-.45;
  }
  const manual=label(s,-.68,1.32,2.15,.55,.66,'しきがみ上手',{bg:'#b8baa0',fg:'#344333',sub:'種子・折り紙細工'});
  target(manual,'shikigami-manual','使用方法を読む',{href:'../brands/shikigami/'});
  tube(s,.7,2.8,1.9,1.21,0xd7ddc6);utility(s,2.45,2.0,-.28,1);shadow(s,.8,.2,3.7,.9);

  // 03 — 祭祀具・異物製品. Tall workshop with a lifted roll door and a tin extension.
  const objects=room('objects','祭祀具・異物製品',-1,8.3,7.0,3.8,3.4,m.concrete,m.concrete),o=objects.group;
  front(objects,.8,3.05,2.55,m.metal);
  box(o,.8,2.92,-.11,3.2,.75,.2,m.shutter);
  for(const x of [-.82,2.43])box(o,x,1.31,-.17,.09,2.62,.14,m.rust);
  box(o,-2.3,1.48,-.12,1.66,2.7,.16,m.rust,true);
  for(let x=-3.1;x<-1.5;x+=.18)box(o,x,1.48,-.22,.025,2.68,.07,m.metal);
  const aw=box(o,-.12,3.47,-.46,7.3,.06,1.05,m.rust);aw.rotation.x=.07;
  box(o,-2.08,2.43,-.38,2.1,.73,.06,m.wood).rotation.z=.025;
  label(o,-2.08,2.44,-.422,1.99,.62,'祭祀具',{bg:'#7a755f',fg:'#272f26',sub:'異物製品'}).rotation.z=.025;
  label(o,-2.65,1.55,-.24,.35,.49,'雨に弱い',{bg:'#bcb299',fg:'#4b4738',vertical:true});
  utility(o,-2.56,.62,-.46);fan(o,2.92,2.63,-.20,.53);
  pipe(o,[[-3.25,3.2,-.22],[-2.95,3.2,-.22],[-2.95,1.87,-.25],[-1.37,1.87,-.25],[-1.37,2.76,-.25]],.063,m.rust);
  // A capped pipe that has outlived its original appliance.
  cylinder(o,-1.37,2.8,-.25,.083,.05,m.brass);
  desk(o,-1.65,2.76,2.56,.85,m.wood);shelf(o,2.85,2.30,.70,2.3,.52);
  box(o,-2.26,.91,2.72,.24,.19,.2,m.metal);box(o,-1.9,.86,2.79,.4,.08,.3,m.paper);
  for(let i=0;i<6;i++)box(o,-2.62+i*.17,.87,2.76,.095,.075,.19,i%2?m.cream:m.metal).rotation.y=i*.32;
  cylinder(o,1.9,.32,3.04,.31,.64,m.rust);shadow(o,1.9,3.04,.9,.9);
  // The product image is the repository's existing object study, not a new product claim.
  const study=new THREE.TextureLoader().load(new URL('../assets/teruteru-bot-turntable.svg',import.meta.url).href);study.colorSpace=THREE.SRGBColorSpace;
  panel(o,-1.91,1.82,3.64,1.26,.72,study);
  const product=label(o,-1.34,1.29,2.60,.7,.38,'テルテルボット',{bg:'#beb79d',fg:'#3b3c32'});
  target(product,'object-study','制作物を見る',{href:'../products/joke/'});
  // A black hanging implement from the existing ritual-object category.
  cable(o,[[.17,3.4,3.17],[.17,2.16,3.17]],0x403e30,.009);
  sphere(o,.17,2.06,3.17,.13,m.blackwood);
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(.24,.4,7),m.blackwood);skirt.position.set(.17,1.76,3.17);o.add(skirt);
  tube(o,-1.3,3.12,2.2,1.54,0xe1ddc2);shadow(o,.8,.27,3.4,1.3);

  // 04 — 未祓い. A tiled small office with a narrow hinged door and wire glass.
  const mih=room('miharai','未祓い観測',1,3.95,6.5,4.35,2.56,m.plaster,m.tile),t=mih.group;
  front(mih,-1.57,1.23,2.11,m.tile);
  box(t,-1.57,2.22,-.09,1.46,.2,.12,m.metal);
  // Hinged leaf is open into the room. Its conservative collision footprint is visible.
  box(t,-2.13,1.04,.61,.07,2.08,1.05,m.wood,true);
  box(t,-2.09,1.49,.65,.025,.77,.79,glass);box(t,-2.03,.93,.94,.1,.04,.04,m.brass);
  box(t,.93,1.61,-.10,3.12,1.22,.1,m.metal);
  const frosted=paint(0x929d86);box(t,.93,1.63,-.17,2.98,1.07,.026,frosted);
  for(let i=0;i<16;i++)box(t,-.5+i*.19,1.63,-.19,.008,1.05,.01,m.pipe);
  for(const x of [-.62,.43,1.48,2.52])box(t,x,1.63,-.21,.04,1.12,.07,m.cream);
  box(t,.93,1.64,-.215,3.1,.035,.04,m.cream);
  label(t,.81,2.36,-.22,3.75,.31,'未祓い',{bg:'#969881',fg:'#3e4b3b',faded:true});
  const mhAw=box(t,.25,2.69,-.32,5.91,.08,.69,m.concrete);mhAw.rotation.z=.012;
  label(t,-2.71,1.53,-.14,.31,.64,'公開台帳',{bg:'#aaa992',fg:'#474d3d',vertical:true});
  utility(t,2.93,1.98,-.18,1);pipe(t,[[3.05,2.7,-.24],[3.05,.18,-.24],[2.38,.18,-.24]],.035,m.pipe);
  desk(t,.62,2.95,2.2,.83,m.metal);box(t,1.95,1.01,4.08,1.24,2.02,.46,m.metal,true);
  for(let j=0;j<6;j++){box(t,1.95,.18+j*.3,3.83,1.12,.275,.025,m.cream);box(t,1.95,.21+j*.3,3.8,.2,.026,.055,m.brass);}
  box(t,.40,1.15,2.91,.71,.56,.51,m.cream);box(t,.4,1.16,2.64,.59,.42,.03,m.black);
  const screen=label(t,.4,1.16,2.615,.53,.36,'未祓い',{bg:'#26342b',fg:'#a4b4a0',sub:'公開台帳'});
  screen.material.emissive=new THREE.Color(0x344534);screen.material.emissiveMap=screen.material.map;screen.material.emissiveIntensity=.32;
  target(screen,'miharai-terminal','公開台帳を開く',{href:'../miharai/'});
  box(t,.48,.865,2.33,.63,.045,.21,m.cream);
  for(let i=0;i<8;i++)box(t,.19+i*.075,.893,2.33,.052,.009,.15,m.pipe);
  label(t,-1.92,1.54,4.19,.85,.62,'観測記録',{bg:'#b9b5a2',fg:'#464c3f'});
  tube(t,.35,2.4,2.15,1.14,0xc6d4b9);fan(t,2.75,2.12,4.13,.35);
  shadow(t,-1.56,.14,1.4,1.3);

  // 05 — 作品保管庫. A broad brick storeroom; arch, steel doors and a sealed transom.
  const archive=room('archive','作品保管庫',-1,-.55,8.1,4.6,3.19,m.brick,m.wood),b=archive.group;
  front(archive,-.56,2.20,2.37,m.brick);
  for(let i=0;i<13;i++){
    const angle=Math.PI*i/12,x=-.56+Math.cos(angle)*1.22,y=2.08+Math.sin(angle)*.71;
    box(b,x,y,-.12,.22,.22,.22,m.concrete).rotation.z=angle;
  }
  box(b,.64,1.03,.54,.09,2.08,1.02,m.metal,true);
  for(let i=0;i<4;i++)box(b,.58,1.08,.15+i*.23,.035,1.78,.025,m.rust);
  box(b,2.47,1.28,-.10,2.14,2.43,.11,m.shutter,true);
  box(b,2.44,2.59,-.13,2.32,.24,.25,m.rust);
  box(b,-2.95,1.60,-.08,1.20,1.57,.1,m.blackwood);
  for(const y of [.98,1.57,2.18])box(b,-2.95,y,-.17,1.23,.06,.09,m.wood);
  for(const x of [-3.58,-2.96,-2.33])box(b,x,1.6,-.17,.06,1.65,.09,m.wood);
  for(let i=0;i<5;i++){
    const x=-1.76+i*.68;box(b,x,3.01,-.13,.59,.56,.13,m.metal);
    const ch=label(b,x,3.01,-.207,.5,.47,[...'作品保管庫'][i],{bg:'#454c42',fg:i===2?'#666f58':'#bfc8ae'});
    ch.material.emissive=new THREE.Color(i===2?0x000000:0x171c12);
  }
  pipe(b,[[-3.87,3.31,-.2],[-3.87,.17,-.2],[-3.1,.17,-.24]],.07,m.rust);
  utility(b,3.45,2.83,-.22);label(b,2.44,1.42,-.18,.61,.78,'保管庫',{bg:'#a9a181',fg:'#4b4b3a',vertical:true,faded:true});
  for(const x of [-2.84,2.79]){
    shelf(b,x,3.93,1.57,2.6,.5);
    for(let j=0;j<4;j++)for(let k=0;k<3;k++){
      box(b,x-.48+k*.46,.36+j*.71,3.95,.4,.34,.41,k===1?m.wood:m.paper);
      label(b,x-.48+k*.46,.38+j*.71,3.73,.19,.11,String(1+j*3+k).padStart(2,'0'),{bg:'#bcb79d',fg:'#454537'});
    }
  }
  desk(b,-.72,3.57,1.7,.76,m.wood);
  box(b,-.72,1.18,3.55,.91,.62,.65,m.cream);box(b,-.72,1.18,3.21,.77,.48,.035,m.black);
  const crt=label(b,-.72,1.18,3.182,.68,.39,'忍者解釈',{bg:'#29352b',fg:'#bcc7ad',sub:'事件記録'});
  crt.material.emissive=new THREE.Color(0x263828);crt.material.emissiveMap=crt.material.map;crt.material.emissiveIntensity=.38;
  target(crt,'ninja-terminal','事件記録を開く',{href:'../works/ninja-kaishaku/app.html'});
  const register=label(b,1.47,1.4,3.45,.60,.81,'作品目録',{bg:'#b7ad8e',fg:'#494634'});
  target(register,'works-register','目録を開く',{href:'../works/'});
  // A second terminal is old equipment on a different desk, not another floating menu.
  desk(b,-3.06,1.9,1.2,.57,m.metal);
  box(b,-3.06,1.15,1.94,.51,.57,.36,m.metal);
  const divine=label(b,-3.06,1.18,1.73,.43,.41,'バリ・レベチ',{bg:'#524f31',fg:'#c1b488',sub:'祈願端末'});
  target(divine,'bari-terminal','祈願端末を開く',{href:'../works/bari-rebechi/app.html'});
  tube(b,-.8,3.01,2.38,.78,0xd3cba4);shadow(b,-.55,.26,2.65,1.2);

  // 06 — shuttered former shop. Nothing clicks; its old sign isn't a new business.
  const empty=room('vacant','',1,18.65,4.5,2.1,2.46,m.tile,m.concrete),v=empty.group;
  box(v,0,1.13,0,3.84,2.26,.13,m.shutter,true);
  for(const x of [-2.16,2.16])box(v,x,1.23,-.08,.23,2.46,.31,m.tile,true);
  box(v,0,2.51,-.16,4.33,.42,.32,m.concrete);
  label(v,0,2.53,-.34,3.9,.3,'商店',{bg:'#938b70',fg:'#76725d',faded:true});
  box(v,.31,1.13,-.1,1.08,.73,.05,m.wood).rotation.z=.065;
  for(const x of [-.2,.71])box(v,x,1.4,-.17,.08,.19,.01,m.cream).rotation.z=.18;
  box(v,-1.5,.09,-.32,.7,.16,.39,m.rust);
  pipe(v,[[1.7,2.5,-.3],[1.7,1.1,-.3],[1.89,1.1,-.3]],.035,m.pipe);
  utility(v,-1.32,1.96,-.24,1);

  // 07 — 札所. A squat counter squeezed between later concrete partitions.
  const fuda=room('fudasho','札所',1,-4.8,5.6,1.9,2.26,m.concrete,m.concrete),f=fuda.group;
  box(f,0,.53,-.06,5.4,1.06,.2,m.concrete,true);
  box(f,0,1.08,-.2,5.36,.075,.73,m.wood,true);
  for(const x of [-2.58,0,2.58])box(f,x,1.67,-.02,.08,1.18,.1,m.wood,true);
  box(f,-1.3,1.69,.07,2.48,1.04,.06,m.shutter,true);
  box(f,0,2.2,-.12,5.6,.23,.3,m.rust);
  const fAw=box(f,0,2.43,-.49,5.85,.06,1.0,m.roof);fAw.rotation.x=-.16;
  label(f,.63,2.17,-.291,1.35,.21,'札所',{bg:'#96916e',fg:'#3d4031'});
  label(f,1.8,1.73,1.72,.46,.68,'第〇九一號',{bg:'#484b37',fg:'#c2be99',vertical:true});
  const kiln=label(f,1.2,1.49,.56,.75,.63,'札所',{bg:'#25271e',fg:'#b9af83',sub:'絵は窯、字は籤、筆はお前'});
  target(kiln,'fudasho-ledger','札所を開く',{href:'../archive/neocities/fudasho-observation-091.html'});
  box(f,.77,1.18,.35,.65,.14,.36,m.paper);tube(f,.91,2.03,.47,.53,0xdbd2a5);
  utility(f,-2.08,1.57,-.31,1);

  // 08 — closed research room. The current /research/ really has no notes.
  const research=room('research','研究',-1,-8.25,5.0,2.15,2.6,m.plaster,m.concrete),r=research.group;
  box(r,0,1.24,0,4.8,2.48,.1,m.plaster,true);
  box(r,-.74,1.07,-.1,1.05,2.14,.12,m.metal,true);
  label(r,-.74,1.74,-.17,.48,.22,'研究',{bg:'#7d8069',fg:'#313c31'});
  box(r,-.71,1.00,-.19,.39,.09,.1,m.black);
  const note=label(r,1.03,1.47,-.18,.6,.79,'研究ノート',{bg:'#c1b89b',fg:'#56513e',sub:'まだありません。'});
  target(note,'research-note','掲示を読む',{href:'../research/'});
  box(r,0,2.66,-.28,5.2,.12,.6,m.concrete);
  utility(r,1.87,2.05,-.3,1);fan(r,1.56,2.26,-.22,.33);
  pipe(r,[[-2.13,2.83,-.31],[-2.13,.1,-.31],[-1.23,.1,-.42]],.056,m.rust);

  // Fans retain their transforms when static meshes are instanced.
  for(const root of [p,s,o,t,b,v,f,r])root.traverse(obj=>{
    if(obj.isGroup&&obj!==root)obj.userData.live=true;
  });
}
