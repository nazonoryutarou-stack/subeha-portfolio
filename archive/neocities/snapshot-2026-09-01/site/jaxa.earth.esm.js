<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>ローポリ捏ね UV版</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{--ink:#e9e6de;--mid:#8c897f;--dim:#4a473f;--line:#2a2824;--bg:#161512;--hi:#e0a23a;--blue:#5fb0d8;
    --serif:'Shippori Mincho B1',serif;--mono:'IBM Plex Mono',monospace;}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  html,body{height:100%;background:#161512;overflow:hidden;font-family:var(--mono);color:var(--ink);touch-action:none;}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block;}
  .top{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:10px;
    padding:calc(8px + env(safe-area-inset-top,0px)) 14px 8px;
    background:linear-gradient(180deg,rgba(8,8,7,.6),transparent);pointer-events:none;}
  .top h1{font-family:var(--serif);font-size:.95rem;font-weight:700;letter-spacing:.22em;}
  .top .sp{flex:1;}.top .stat{font-size:.5rem;letter-spacing:.06em;color:var(--mid);text-align:right;line-height:1.5;}
  .top .hbtn{pointer-events:auto;font-size:.62rem;color:var(--ink);background:rgba(8,8,7,.6);border:1px solid var(--line);width:30px;height:30px;cursor:pointer;}
  .dock{position:fixed;left:0;right:0;bottom:0;z-index:6;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));
    background:linear-gradient(0deg,rgba(8,8,7,.92),rgba(8,8,7,.72));border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px;}
  .row{display:flex;gap:6px;justify-content:center;}
  .btn,.sel{flex:1;min-width:0;font-family:var(--mono);font-size:.62rem;letter-spacing:.06em;color:var(--ink);
    background:rgba(20,20,18,.9);border:1px solid var(--line);padding:11px 4px;cursor:pointer;white-space:nowrap;}
  .sel{padding:0 5px;font-size:.58rem;}
  .btn:active{background:var(--ink);color:#000;}.btn.on{background:var(--hi);color:#000;border-color:var(--hi);}.btn.axis.on{background:var(--blue);color:#000;border-color:var(--blue);}
  .btn.wide{flex:1.4;}.lab{font-size:.46rem;color:var(--dim);letter-spacing:.2em;align-self:center;padding:0 2px;}
  .help{position:fixed;inset:0;z-index:20;background:rgba(6,6,5,.94);display:none;align-items:center;justify-content:center;padding:24px;}
  .help.on{display:flex;}.help .box{width:min(92vw,430px);max-height:84vh;overflow-y:auto;border:1px solid var(--line);background:#0d0d0b;padding:24px 22px;}
  .help h2{font-family:var(--serif);font-size:1.2rem;letter-spacing:.2em;text-align:center;margin-bottom:4px;}.help .s{font-size:.5rem;letter-spacing:.3em;color:var(--dim);text-align:center;margin-bottom:18px;}
  .help p{font-size:.74rem;line-height:2;letter-spacing:.03em;color:#cbc8bf;margin:9px 0;}.help p b{color:var(--hi);font-weight:500;}
  .help .close{width:100%;margin-top:16px;font-family:var(--mono);font-size:.66rem;letter-spacing:.2em;color:var(--ink);background:none;border:1px solid var(--mid);padding:13px;cursor:pointer;}
  .help .close:active{background:var(--ink);color:#000;}
  #texInput{display:none;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<input id="texInput" type="file" accept="image/*">

<div class="top">
  <h1>ローポリ捏ね</h1><span class="sp"></span>
  <div class="stat" id="stat">頂点 0 ／ 面 0</div>
  <button class="hbtn" id="helpBtn" type="button">?</button>
</div>

<div class="dock">
  <div class="row">
    <span class="lab">選択</span>
    <button class="btn on" id="mVert" type="button">頂点</button><button class="btn" id="mEdge" type="button">辺</button><button class="btn" id="mFace" type="button">面</button><button class="btn" id="mObj" type="button">物</button>
    <span class="lab">軸</span>
    <button class="btn axis" id="aX" type="button">X</button><button class="btn axis" id="aY" type="button">Y</button><button class="btn axis" id="aZ" type="button">Z</button>
  </div>
  <div class="row">
    <button class="btn wide" id="opExtrude" type="button">面出し</button><button class="btn" id="opSub" type="button">分割</button><button class="btn" id="opDel" type="button">消す</button>
    <button class="btn" id="opUndo" type="button">戻す</button><button class="btn" id="opRedo" type="button">進む</button>
  </div>
  <div class="row">
    <button class="btn axis" id="opMirror" type="button">ミラー</button><button class="btn" id="opCenter" type="button">中心へ</button><button class="btn" id="opWeld" type="button">近接溶接</button>
    <select class="sel" id="preset"><option value="cube">立方体</option><option value="plane">板</option><option value="pyramid">四角錐</option><option value="octa">八面体</option><option value="sphere">低球</option><option value="blade">刀身</option><option value="fuda">札</option><option value="cocoon">蛹</option></select>
    <button class="btn" id="opPreset" type="button">形</button><button class="btn" id="opAdd" type="button">追加</button>
  </div>
  <div class="row">
    <button class="btn" id="opUV" type="button">UV図</button><button class="btn" id="opTex" type="button">色読込</button><button class="btn" id="opSave" type="button">保存</button><button class="btn" id="opLoad" type="button">読込</button><button class="btn wide" id="opObj" type="button">OBJ</button>
  </div>
</div>

<div class="help" id="help">
  <div class="box">
    <h2>捏ねかた</h2><div class="s">LOW-POLY MODELER / UV</div>
    <p><b>回す</b>：何もない所を1本指でなぞる。<b>ズーム</b>：2本指。</p>
    <p><b>動かす</b>：頂点／辺／面を選んで掴む。<b>物</b>は離れた塊ごと掴んで動かす。追加した形を寄せる時に使う。</p>
    <p><b>分割</b>：選んだ面を割る。隣の面にも中間点を差し込み、隙間が出にくい。</p>
    <p><b>消す</b>：頂点なら接続面、辺なら接続面、面ならその面を消す。</p>
    <p><b>面出し</b>：面なら押し出し、辺なら面を一枚生やす。<b>近接溶接</b>は近づけた点同士を自動でくっつける。</p>
    <p><b>UV図</b>：型紙PNGを書き出す。別アプリで塗ってPNG保存し、<b>色読込</b>で戻すと色が付く。</p>
    <p><b>OBJ</b>：OBJ/MTLを書き出す。色読込済みなら texture.png も同時に落とす。</p>
    <button class="close" id="helpClose" type="button">捏ねる</button>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function(){
  if(typeof THREE==='undefined'){document.body.innerHTML='<p style="color:#e9e6de;font-family:monospace;padding:24px">3Dの読み込みに失敗した。通信を確認して開き直してくれ。</p>';return;}

  var canvas=document.getElementById('c');
  var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
  renderer.setClearColor(0x161512,1);
  var scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x161512,14,40);
  var camera=new THREE.PerspectiveCamera(50,1,0.05,200);
  scene.add(new THREE.HemisphereLight(0xfff0dd,0x202028,0.9));
  var dir=new THREE.DirectionalLight(0xffffff,0.7); dir.position.set(4,8,6); scene.add(dir);
  var dir2=new THREE.DirectionalLight(0x88aaff,0.3); dir2.position.set(-5,-2,-4); scene.add(dir2);
  var grid=new THREE.GridHelper(20,20,0x3a382f,0x262420); grid.position.y=-0.001; scene.add(grid);

  function cube(){return {verts:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],faces:[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]]};}
  function plane(){return {verts:[[-1,-.04,-1],[1,-.04,-1],[1,-.04,1],[-1,-.04,1],[-1,.04,-1],[1,.04,-1],[1,.04,1],[-1,.04,1]],faces:[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]]};}
  function pyramid(){return {verts:[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[0,1.6,0]],faces:[[0,1,2,3],[0,4,1],[1,4,2],[2,4,3],[3,4,0]]};}
  function octa(){return {verts:[[0,1.2,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1.2,0]],faces:[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]]};}
  function lowSphere(){var v=[[0,1.2,0],[.85,.6,0],[0,.6,.85],[-.85,.6,0],[0,.6,-.85],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[.85,-.6,0],[0,-.6,.85],[-.85,-.6,0],[0,-.6,-.85],[0,-1.2,0]];var f=[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[1,5,6,2],[2,6,7,3],[3,7,8,4],[4,8,5,1],[5,9,10,6],[6,10,11,7],[7,11,12,8],[8,12,9,5],[13,10,9],[13,11,10],[13,12,11],[13,9,12]];return {verts:v,faces:f};}
  function blade(){return {verts:[[-.12,0,-2.2],[.12,0,-2.2],[.18,0,1.2],[0,0,2.05],[-.18,0,1.2],[-.08,.08,-2.0],[.08,.08,-2.0],[.1,.08,1.1],[0,.08,1.75],[-.1,.08,1.1]],faces:[[0,1,2,3,4],[5,9,8,7,6],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]};}
  function fuda(){return {verts:[[-.65,-.02,-1.4],[.65,-.02,-1.4],[.65,-.02,1.15],[0,-.02,1.55],[-.65,-.02,1.15],[-.65,.02,-1.4],[.65,.02,-1.4],[.65,.02,1.15],[0,.02,1.55],[-.65,.02,1.15]],faces:[[0,1,2,3,4],[5,9,8,7,6],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]};}
  function cocoon(){var M=lowSphere();M.verts=M.verts.map(function(v){return [v[0]*.75,v[1]*.9,v[2]*1.35];});return M;}
  function presetModel(name){return ({cube:cube,plane:plane,pyramid:pyramid,octa:octa,sphere:lowSphere,blade:blade,fuda:fuda,cocoon:cocoon}[name]||cube)();}

  var M=cube();
  var geo=new THREE.BufferGeometry();
  var texture=null, textureDataURL=null;
  var mat=new THREE.MeshLambertMaterial({color:0xb8b2a2,side:THREE.DoubleSide,flatShading:true});
  var mesh=new THREE.Mesh(geo,mat); scene.add(mesh);
  var triFace=[];
  var edgeGeo=new THREE.BufferGeometry(); var edgeLines=new THREE.LineSegments(edgeGeo,new THREE.LineBasicMaterial({color:0x16140f})); scene.add(edgeLines);
  var ptGeo=new THREE.BufferGeometry(); var ptMat=new THREE.PointsMaterial({color:0xe9e6de,size:9,sizeAttenuation:false}); var points=new THREE.Points(ptGeo,ptMat); scene.add(points);
  var mGeo=new THREE.BufferGeometry(); var mMesh=new THREE.Mesh(mGeo,mat); mMesh.visible=false; scene.add(mMesh);
  var mEdgeGeo=new THREE.BufferGeometry(); var mEdges=new THREE.LineSegments(mEdgeGeo,new THREE.LineBasicMaterial({color:0x16140f})); mEdges.visible=false; scene.add(mEdges);
  var selSphere=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,10),new THREE.MeshBasicMaterial({color:0xe0a23a})); selSphere.visible=false; scene.add(selSphere);
  var selLineGeo=new THREE.BufferGeometry(); var selLine=new THREE.Line(selLineGeo,new THREE.LineBasicMaterial({color:0xe0a23a})); selLine.visible=false; scene.add(selLine);

  var elemMode='vert', lockAxis=null, selVert=-1, selFace=-1, selEdge=null, mirrorOn=false;
  var undoStack=[], redoStack=[];

  function cloneM(x){return JSON.parse(JSON.stringify(x));}
  function snapshot(){ undoStack.push(JSON.stringify(M)); if(undoStack.length>80)undoStack.shift(); redoStack=[]; }
  function undo(){ if(!undoStack.length)return; redoStack.push(JSON.stringify(M)); M=JSON.parse(undoStack.pop()); clearSel(); rebuild(); flash('戻した'); }
  function redo(){ if(!redoStack.length)return; undoStack.push(JSON.stringify(M)); M=JSON.parse(redoStack.pop()); clearSel(); rebuild(); flash('進めた'); }
  function clearSel(){ selVert=-1; selFace=-1; selEdge=null; updateSelVisual(); }
  function pushV(arr,v){arr.push(v[0],v[1],v[2]);}
  function pushUV(arr,uv){arr.push(uv[0],uv[1]);}
  function validVert(i){return Number.isInteger(i)&&i>=0&&i<M.verts.length&&M.verts[i]&&isFinite(M.verts[i][0])&&isFinite(M.verts[i][1])&&isFinite(M.verts[i][2]);}
  function cleanFaceRefs(f){if(!f||f.length<3)return null;var out=[];for(var i=0;i<f.length;i++){var id=f[i];if(!validVert(id))return null;if(out.length===0||out[out.length-1]!==id)out.push(id);}if(out.length>1&&out[0]===out[out.length-1])out.pop();var seen={};for(var k=0;k<out.length;k++)seen[out[k]]=1;return Object.keys(seen).length>=3?out:null;}
  function triAreaSq(a,b,c){var ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2],bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];var cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;return cx*cx+cy*cy+cz*cz;}
  function faceAreaSq(f){f=cleanFaceRefs(f);if(!f)return 0;var sum=0,a=M.verts[f[0]];for(var k=1;k<f.length-1;k++)sum+=triAreaSq(a,M.verts[f[k]],M.verts[f[k+1]]);return sum;}
  function faceCentroid(f){var c=[0,0,0];for(var k=0;k<f.length;k++){c[0]+=M.verts[f[k]][0];c[1]+=M.verts[f[k]][1];c[2]+=M.verts[f[k]][2];}return [c[0]/f.length,c[1]/f.length,c[2]/f.length];}
  function faceNormal(f){var n=new THREE.Vector3();for(var k=0;k<f.length;k++){var c=M.verts[f[k]],nx=M.verts[f[(k+1)%f.length]];n.x+=(c[1]-nx[1])*(c[2]+nx[2]);n.y+=(c[2]-nx[2])*(c[0]+nx[0]);n.z+=(c[0]-nx[0])*(c[1]+nx[1]);}if(n.length()<1e-9)n.set(0,1,0);return n.normalize();}
  function mid(a,b){return [(M.verts[a][0]+M.verts[b][0])/2,(M.verts[a][1]+M.verts[b][1])/2,(M.verts[a][2]+M.verts[b][2])/2];}
  function addVert(v){M.verts.push(v.slice());return M.verts.length-1;}
  function edgeKey(a,b){return Math.min(a,b)+'_'+Math.max(a,b);}

  function makeUVAtlas(V,F){
    var valid=[]; for(var fi=0;fi<F.length;fi++){ if(F[fi]&&F[fi].length>=3)valid.push(fi); }
    var n=Math.max(1,valid.length), cols=Math.ceil(Math.sqrt(n)), rows=Math.ceil(n/cols), pad=.08;
    var map={};
    for(var q=0;q<valid.length;q++){
      var fi=valid[q], f=F[fi], col=q%cols, row=Math.floor(q/cols);
      var pts=[], mn=[1e9,1e9], mx=[-1e9,-1e9];
      var normal=normalOfRaw(V,f), ax=Math.abs(normal.x), ay=Math.abs(normal.y), az=Math.abs(normal.z);
      for(var i=0;i<f.length;i++){
        var v=V[f[i]], u,w;
        if(ax>=ay&&ax>=az){u=v[2];w=v[1];} else if(ay>=ax&&ay>=az){u=v[0];w=v[2];} else {u=v[0];w=v[1];}
        pts.push([u,w]); if(u<mn[0])mn[0]=u;if(w<mn[1])mn[1]=w;if(u>mx[0])mx[0]=u;if(w>mx[1])mx[1]=w;
      }
      var sx=mx[0]-mn[0], sy=mx[1]-mn[1]; if(sx<1e-6)sx=1; if(sy<1e-6)sy=1;
      var scale=(1-pad*2)/Math.max(sx,sy); var offx=(1-(sx*scale))/2, offy=(1-(sy*scale))/2;
      map[fi]=pts.map(function(p){
        var lu=offx+(p[0]-mn[0])*scale, lv=offy+(p[1]-mn[1])*scale;
        return [(col+lu)/cols, 1-(row+lv)/rows];
      });
    }
    return {map:map,cols:cols,rows:rows};
  }
  function normalOfRaw(V,f){var n=new THREE.Vector3();for(var k=0;k<f.length;k++){var c=V[f[k]],nx=V[f[(k+1)%f.length]];n.x+=(c[1]-nx[1])*(c[2]+nx[2]);n.y+=(c[2]-nx[2])*(c[0]+nx[0]);n.z+=(c[0]-nx[0])*(c[1]+nx[1]);}if(n.length()<1e-9)n.set(0,1,0);return n.normalize();}

  function rebuild(){
    var hasTex=!!texture;
    var uvInfo=hasTex?makeUVAtlas(M.verts,M.faces):null;
    var pos=[],uvs=[]; triFace=[];
    for(var fi=0;fi<M.faces.length;fi++){
      var f=cleanFaceRefs(M.faces[fi]); if(!f||faceAreaSq(f)<1e-12)continue;
      var fuv=hasTex?uvInfo.map[fi]:null; if(hasTex&&!fuv)continue;
      for(var k=1;k<f.length-1;k++){
        if(triAreaSq(M.verts[f[0]],M.verts[f[k]],M.verts[f[k+1]])<1e-12)continue;
        pushV(pos,M.verts[f[0]]);pushV(pos,M.verts[f[k]]);pushV(pos,M.verts[f[k+1]]);
        if(hasTex){pushUV(uvs,fuv[0]);pushUV(uvs,fuv[k]);pushUV(uvs,fuv[k+1]);} triFace.push(fi);
      }
    }
    geo.dispose(); geo=new THREE.BufferGeometry(); mesh.geometry=geo;
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); if(hasTex)geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    if(pos.length>=9){geo.computeVertexNormals();geo.computeBoundingSphere();}
    var eset={},ep=[];
    for(var fi2=0;fi2<M.faces.length;fi2++){var f2=cleanFaceRefs(M.faces[fi2]);if(!f2)continue;for(var k2=0;k2<f2.length;k2++){var a=f2[k2],b=f2[(k2+1)%f2.length],key=edgeKey(a,b);if(a!==b&&!eset[key]){eset[key]=1;pushV(ep,M.verts[a]);pushV(ep,M.verts[b]);}}}
    edgeGeo.dispose(); edgeGeo=new THREE.BufferGeometry(); edgeLines.geometry=edgeGeo; edgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));
    var pp=[];for(var i=0;i<M.verts.length;i++)if(validVert(i))pushV(pp,M.verts[i]);
    ptGeo.dispose();ptGeo=new THREE.BufferGeometry();points.geometry=ptGeo;ptGeo.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));
    buildMirror(); if(selFace>=M.faces.length||(selFace>=0&&!cleanFaceRefs(M.faces[selFace])))selFace=-1; updateSelVisual();updateStat();
  }
  function updateStat(){document.getElementById('stat').textContent='頂点 '+M.verts.length+' ／ 面 '+M.faces.length;}
  function updateSelVisual(){selSphere.visible=false;selLine.visible=false;if(elemMode==='vert'&&selVert>=0&&validVert(selVert)){var v=M.verts[selVert];selSphere.position.set(v[0],v[1],v[2]);selSphere.visible=true;}else if(elemMode==='edge'&&selEdge){var a=M.verts[selEdge[0]],b=M.verts[selEdge[1]];selLineGeo.setAttribute('position',new THREE.Float32BufferAttribute([a[0],a[1],a[2],b[0],b[1],b[2]],3));selLine.visible=true;}else if((elemMode==='face'||elemMode==='object')&&selFace>=0){var f=cleanFaceRefs(M.faces[selFace]);if(!f)return;var arr=[];for(var k=0;k<=f.length;k++){var v2=M.verts[f[k%f.length]];arr.push(v2[0],v2[1],v2[2]);}selLineGeo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));selLine.visible=true;}}

  var camR=6,camTheta=.7,camPhi=1.0,target=new THREE.Vector3(0,0,0);
  function updateCam(){var sp=Math.sin(camPhi);camera.position.set(target.x+camR*sp*Math.sin(camTheta),target.y+camR*Math.cos(camPhi),target.z+camR*sp*Math.cos(camTheta));camera.lookAt(target);}
  function screenXY(t){var r=canvas.getBoundingClientRect();return {x:t.clientX-r.left,y:t.clientY-r.top,w:r.width,h:r.height};}
  function project(v){var p=new THREE.Vector3(v[0],v[1],v[2]).project(camera),r=canvas.getBoundingClientRect();return {x:(p.x*.5+.5)*r.width,y:(-p.y*.5+.5)*r.height,z:p.z};}
  function ndc(p){return new THREE.Vector2((p.x/p.w)*2-1,-(p.y/p.h)*2+1);} var ray=new THREE.Raycaster();
  function pickVert(p){var best=-1,bd=26*26;for(var i=0;i<M.verts.length;i++){var s=project(M.verts[i]);if(s.z>1)continue;var dx=s.x-p.x,dy=s.y-p.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=i;}}return best;}
  function ptSeg(px,py,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,t=l2>0?((px-ax)*dx+(py-ay)*dy)/l2:0;t=Math.max(0,Math.min(1,t));var qx=ax+t*dx,qy=ay+t*dy;return (px-qx)*(px-qx)+(py-qy)*(py-qy);}
  function pickEdge(p){var best=null,bd=22*22,seen={};for(var fi=0;fi<M.faces.length;fi++){var f=cleanFaceRefs(M.faces[fi]);if(!f)continue;for(var k=0;k<f.length;k++){var a=f[k],b=f[(k+1)%f.length],key=edgeKey(a,b);if(seen[key])continue;seen[key]=1;var sa=project(M.verts[a]),sb=project(M.verts[b]);if(sa.z>1||sb.z>1)continue;var d=ptSeg(p.x,p.y,sa.x,sa.y,sb.x,sb.y);if(d<bd){bd=d;best=[a,b];}}}return best;}
  function pickFace(p){ray.setFromCamera(ndc(p),camera);var hits=ray.intersectObject(mesh,false);if(hits.length){var fi=triFace[hits[0].faceIndex];return fi!==undefined?fi:-1;}return -1;}

  var drag=null;
  function beginDragVerts(idxList,anchor){snapshot();var start={};idxList.forEach(function(i){start[i]=M.verts[i].slice();});var camDir=new THREE.Vector3();camera.getWorldDirection(camDir);var plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camDir,new THREE.Vector3(anchor[0],anchor[1],anchor[2]));drag={verts:idxList,start:start,anchor:anchor.slice(),plane:plane};}
  function moveDrag(p){if(!drag)return;ray.setFromCamera(ndc(p),camera);var hit=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,hit))return;var dx=hit.x-drag.anchor[0],dy=hit.y-drag.anchor[1],dz=hit.z-drag.anchor[2];if(lockAxis==='x'){dy=0;dz=0;}else if(lockAxis==='y'){dx=0;dz=0;}else if(lockAxis==='z'){dx=0;dy=0;}drag.verts.forEach(function(i){var s=drag.start[i];M.verts[i]=[s[0]+dx,s[1]+dy,s[2]+dz];});rebuild();}
  function endDrag(){drag=null;}

  function insertMidpointsIntoAdjacent(edgeMid,skip){for(var fi=0;fi<M.faces.length;fi++){if(fi===skip)continue;var f=cleanFaceRefs(M.faces[fi]);if(!f)continue;var nf=[];for(var i=0;i<f.length;i++){var a=f[i],b=f[(i+1)%f.length],key=edgeKey(a,b);nf.push(a);if(edgeMid[key]!==undefined&&nf.indexOf(edgeMid[key])<0)nf.push(edgeMid[key]);}M.faces[fi]=nf;}}
  function subdivide(){if(selFace<0||selFace>=M.faces.length){flash('面を選んでね');return;}var f=cleanFaceRefs(M.faces[selFace]);if(!f||faceAreaSq(f)<1e-12){flash('その面は潰れている');return;}snapshot();f=f.slice();var edgeMid={};for(var i=0;i<f.length;i++){edgeMid[edgeKey(f[i],f[(i+1)%f.length])]=addVert(mid(f[i],f[(i+1)%f.length]));}insertMidpointsIntoAdjacent(edgeMid,selFace);var newFaces=[];if(f.length===3){var m1=edgeMid[edgeKey(f[0],f[1])],m2=edgeMid[edgeKey(f[1],f[2])],m3=edgeMid[edgeKey(f[2],f[0])];newFaces.push([f[0],m1,m3],[m1,f[1],m2],[m3,m2,f[2]],[m1,m2,m3]);}else{var ct=addVert(faceCentroid(f));for(var j=0;j<f.length;j++){var prev=(j+f.length-1)%f.length;newFaces.push([f[j],edgeMid[edgeKey(f[j],f[(j+1)%f.length])],ct,edgeMid[edgeKey(f[prev],f[j])]]);}}
    M.faces.splice.apply(M.faces,[selFace,1].concat(newFaces));clearSel();rebuild();flash('分割した');}
  function extrude(){if(selFace<0)return;var f=cleanFaceRefs(M.faces[selFace]);if(!f)return;snapshot();var n=f.length,base=M.verts.length,ni=[];for(var k=0;k<n;k++){var v=M.verts[f[k]];M.verts.push([v[0],v[1],v[2]]);ni.push(base+k);}for(var k2=0;k2<n;k2++){var a=f[k2],b=f[(k2+1)%n];M.faces.push([a,b,ni[(k2+1)%n],ni[k2]]);}var nor=faceNormal(f);for(var k3=0;k3<n;k3++){M.verts[ni[k3]][0]+=nor.x*.35;M.verts[ni[k3]][1]+=nor.y*.35;M.verts[ni[k3]][2]+=nor.z*.35;}M.faces[selFace]=ni;rebuild();updateSelVisual();}
  function extrudeEdge(){if(!selEdge)return;snapshot();var a=selEdge[0],b=selEdge[1],nrm=new THREE.Vector3();for(var fi=0;fi<M.faces.length;fi++){var f=cleanFaceRefs(M.faces[fi]);if(f&&f.indexOf(a)>=0&&f.indexOf(b)>=0)nrm.add(faceNormal(f));}if(nrm.length()<1e-6)nrm.set(0,1,0);nrm.normalize();var va=M.verts[a],vb=M.verts[b];var na=addVert([va[0]+nrm.x*.6,va[1]+nrm.y*.6,va[2]+nrm.z*.6]);var nb=addVert([vb[0]+nrm.x*.6,vb[1]+nrm.y*.6,vb[2]+nrm.z*.6]);M.faces.push([a,b,nb,na]);selEdge=[na,nb];rebuild();updateSelVisual();}
  function compact(){var used={},order=[],map={};M.faces.forEach(function(f){f.forEach(function(i){if(validVert(i)&&!(i in used)){used[i]=1;map[i]=order.length;order.push(i);}});});var nv=order.map(function(i){return M.verts[i];});M.faces=M.faces.map(function(f){return f.map(function(i){return map[i];});}).filter(function(f){var seen={};f.forEach(function(i){seen[i]=1;});return Object.keys(seen).length>=3;});M.verts=nv;}
  function delSelection(){snapshot();if(elemMode==='object'&&selFace>=0){var comp=componentFromFace(selFace),kill={};comp.faces.forEach(function(i){kill[i]=1;});M.faces=M.faces.filter(function(f,idx){return !kill[idx];});}else if(elemMode==='face'&&selFace>=0){M.faces.splice(selFace,1);}else if(elemMode==='edge'&&selEdge){var a=selEdge[0],b=selEdge[1];M.faces=M.faces.filter(function(f){return !(f.indexOf(a)>=0&&f.indexOf(b)>=0);});}else if(elemMode==='vert'&&selVert>=0){var v=selVert;M.faces=M.faces.filter(function(f){return f.indexOf(v)<0;});}else{flash('選択してね');return;}compact();clearSel();rebuild();flash('消した');}
  function componentFromFace(startFi){
    var start=cleanFaceRefs(M.faces[startFi]);
    if(!start)return {faces:[],verts:[]};
    var usedF={},usedV={},q=[startFi];usedF[startFi]=1;
    while(q.length){
      var fi=q.shift(),f=cleanFaceRefs(M.faces[fi]);if(!f)continue;
      for(var i=0;i<f.length;i++)usedV[f[i]]=1;
      for(var j=0;j<M.faces.length;j++){
        if(usedF[j])continue;
        var g=cleanFaceRefs(M.faces[j]);if(!g)continue;
        var hit=false;for(var k=0;k<g.length;k++){if(usedV[g[k]]){hit=true;break;}}
        if(hit){usedF[j]=1;q.push(j);}
      }
    }
    return {faces:Object.keys(usedF).map(function(x){return parseInt(x,10);}),verts:Object.keys(usedV).map(function(x){return parseInt(x,10);})};
  }
  function vertsCentroid(list){var c=[0,0,0];if(!list.length)return c;list.forEach(function(i){var v=M.verts[i];c[0]+=v[0];c[1]+=v[1];c[2]+=v[2];});return [c[0]/list.length,c[1]/list.length,c[2]/list.length];}
  function selVertsList(){if(elemMode==='vert'&&selVert>=0)return [selVert];if(elemMode==='edge'&&selEdge)return [selEdge[0],selEdge[1]];if(elemMode==='face'&&selFace>=0)return cleanFaceRefs(M.faces[selFace])||[];if(elemMode==='object'&&selFace>=0)return componentFromFace(selFace).verts;return [];}
  function center(){var vs=selVertsList();if(!vs.length){flash('選択してね');return;}snapshot();vs.forEach(function(i){M.verts[i][0]=0;});rebuild();flash('中心へ寄せた');}
  function mergeVerts(verts,faces,eps){var map={},nv=[],remap=[];function key(v){return Math.round(v[0]/eps)+'_'+Math.round(v[1]/eps)+'_'+Math.round(v[2]/eps);}for(var i=0;i<verts.length;i++){var k=key(verts[i]);if(k in map)remap[i]=map[k];else{map[k]=nv.length;remap[i]=nv.length;nv.push(verts[i].slice());}}var nf=[];for(var f=0;f<faces.length;f++){var face=faces[f].map(function(x){return remap[x];});var clean=[];for(var k2=0;k2<face.length;k2++)if(face[k2]!==face[(k2+face.length-1)%face.length])clean.push(face[k2]);var uniq={};clean.forEach(function(x){uniq[x]=1;});if(Object.keys(uniq).length>=3)nf.push(clean);}return {verts:nv,faces:nf};}
  function mergeCloseVerts(verts,faces,eps){
    var n=verts.length,parent=[];for(var i=0;i<n;i++)parent[i]=i;
    function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;}
    function unite(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a;}
    var e2=eps*eps;
    for(var a=0;a<n;a++)for(var b=a+1;b<n;b++){
      var va=verts[a],vb=verts[b],dx=va[0]-vb[0],dy=va[1]-vb[1],dz=va[2]-vb[2];
      if(dx*dx+dy*dy+dz*dz<=e2)unite(a,b);
    }
    var groups={},remap=[],nv=[];
    for(var i2=0;i2<n;i2++){var r=find(i2);if(!groups[r])groups[r]=[];groups[r].push(i2);}
    Object.keys(groups).forEach(function(r){
      var g=groups[r],c=[0,0,0];
      g.forEach(function(i){c[0]+=verts[i][0];c[1]+=verts[i][1];c[2]+=verts[i][2];});
      c=[c[0]/g.length,c[1]/g.length,c[2]/g.length];
      var ni=nv.length;nv.push(c);g.forEach(function(i){remap[i]=ni;});
    });
    var nf=[];
    for(var f=0;f<faces.length;f++){
      var src=faces[f],clean=[];
      for(var k=0;k<src.length;k++){var id=remap[src[k]];if(id===undefined)continue;if(clean.length===0||clean[clean.length-1]!==id)clean.push(id);}
      if(clean.length>1&&clean[0]===clean[clean.length-1])clean.pop();
      var uniq={};clean.forEach(function(x){uniq[x]=1;});
      if(Object.keys(uniq).length>=3)nf.push(clean);
    }
    return {verts:nv,faces:nf,merged:n-nv.length};
  }
  function applyMirrorToModel(){
    if(!mirrorOn)return false;
    var base=M.verts.length;
    for(var i=0;i<base;i++){var v=M.verts[i];M.verts.push([-v[0],v[1],v[2]]);}
    var faces0=M.faces.slice();
    for(var fi=0;fi<faces0.length;fi++){
      var f=cleanFaceRefs(faces0[fi]);
      if(f)M.faces.push(f.slice().reverse().map(function(x){return base+x;}));
    }
    mirrorOn=false;
    document.getElementById('opMirror').classList.remove('on');
    return true;
  }
  function weld(){
    snapshot();
    var applied=applyMirrorToModel();
    var r=mergeCloseVerts(M.verts,M.faces,0.05);
    M={verts:r.verts,faces:r.faces};
    compact();
    clearSel();
    rebuild();
    if(r.merged>0)flash((applied?'ミラー適用＋':'')+'近接溶接 '+r.merged+'点');
    else flash(applied?'ミラーを実体化':'近い点が無い');
  }
  function bakeMirrorIfOn(){
    if(!mirrorOn)return false;
    snapshot();
    applyMirrorToModel();
    var r=mergeVerts(M.verts,M.faces,1e-4);
    M={verts:r.verts,faces:r.faces};
    compact();
    clearSel();
    rebuild();
    return true;
  }

  function buildMirror(){if(!mirrorOn){mMesh.visible=false;mEdges.visible=false;return;}var posAttr=geo.getAttribute('position'),uvAttr=geo.getAttribute('uv'),posArr=posAttr?posAttr.array:[],uvArr=uvAttr?uvAttr.array:[],mp=[],mu=[];for(var t=0,ut=0;t<posArr.length;t+=9,ut+=6){mp.push(-posArr[t],posArr[t+1],posArr[t+2],-posArr[t+6],posArr[t+7],posArr[t+8],-posArr[t+3],posArr[t+4],posArr[t+5]);mu.push(uvArr[ut],uvArr[ut+1],uvArr[ut+4],uvArr[ut+5],uvArr[ut+2],uvArr[ut+3]);}mGeo.dispose();mGeo=new THREE.BufferGeometry();mMesh.geometry=mGeo;mGeo.setAttribute('position',new THREE.Float32BufferAttribute(mp,3));mGeo.setAttribute('uv',new THREE.Float32BufferAttribute(mu,2));if(mp.length>=9)mGeo.computeVertexNormals();var edgeAttr=edgeGeo.getAttribute('position'),ea=edgeAttr?edgeAttr.array:[],me=[];for(var u=0;u<ea.length;u+=3)me.push(-ea[u],ea[u+1],ea[u+2]);mEdgeGeo.dispose();mEdgeGeo=new THREE.BufferGeometry();mEdges.geometry=mEdgeGeo;mEdgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(me,3));mMesh.visible=true;mEdges.visible=true;}

  function drawUVGuide(){bakeMirrorIfOn();var size=1024,cv=document.createElement('canvas');cv.width=cv.height=size;var ctx=cv.getContext('2d');ctx.fillStyle='#f4efe3';ctx.fillRect(0,0,size,size);var uv=makeUVAtlas(M.verts,M.faces).map;ctx.lineWidth=2;ctx.font='18px monospace';ctx.textAlign='center';ctx.textBaseline='middle';for(var fi=0;fi<M.faces.length;fi++){var f=cleanFaceRefs(M.faces[fi]),u=uv[fi];if(!f||!u)continue;ctx.beginPath();for(var i=0;i<u.length;i++){var x=u[i][0]*size,y=(1-u[i][1])*size;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle='rgba(224,162,58,.12)';ctx.fill();ctx.strokeStyle='#111';ctx.stroke();var cx=0,cy=0;for(var k=0;k<u.length;k++){cx+=u[k][0]*size;cy+=(1-u[k][1])*size;}ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(String(fi),cx/u.length,cy/u.length);}ctx.fillStyle='#111';ctx.font='24px monospace';ctx.textAlign='left';ctx.fillText('lowpoly_kone_uv  paint over this image',18,30);downloadDataURL(cv.toDataURL('image/png'),'uv_guide.png');flash('UV図を書き出した');}
  function applyTextureDataURL(url){var img=new Image();img.onload=function(){texture=new THREE.Texture(img);texture.needsUpdate=true;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.wrapS=THREE.ClampToEdgeWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;mat.map=texture;mat.color.setHex(0xffffff);mat.needsUpdate=true;textureDataURL=url;rebuild();flash('色を読込んだ');};img.src=url;}
  function chooseTexture(){bakeMirrorIfOn();document.getElementById('texInput').click();}
  document.getElementById('texInput').addEventListener('change',function(e){var file=e.target.files&&e.target.files[0];if(!file)return;var rd=new FileReader();rd.onload=function(){applyTextureDataURL(rd.result);};rd.readAsDataURL(file);e.target.value='';});
  function downloadDataURL(url,name){var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);}
  function downloadText(text,name,type){var blob=new Blob([text],{type:type||'text/plain'});var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);}

  function exportOBJ(){
    bakeMirrorIfOn();
    var V=M.verts.map(function(v){return v.slice();}),F=M.faces.map(function(f){return f.slice();});
    if(mirrorOn){var base=V.length;for(var i=0;i<M.verts.length;i++){var v=M.verts[i];V.push([-v[0],v[1],v[2]]);}for(var fi=0;fi<M.faces.length;fi++){F.push(M.faces[fi].slice().reverse().map(function(x){return base+x;}));}}
    var r=mergeVerts(V,F,1e-4);V=r.verts;F=r.faces;if(!F.length){flash('面が無い');return;}
    var uv=makeUVAtlas(V,F).map, used={},map={},order=[];F.forEach(function(f){f.forEach(function(x){if(!(x in used)){used[x]=1;map[x]=order.length+1;order.push(x);}});});
    var s='# low-poly (ローポリ捏ね)\n'; if(textureDataURL)s+='mtllib model.mtl\nusemtl texture_material\n';
    order.forEach(function(x){var v=V[x];s+='v '+v[0].toFixed(5)+' '+v[1].toFixed(5)+' '+v[2].toFixed(5)+'\n';});
    var vt=[],faceUV=[];F.forEach(function(f,fi){var uvi=[],uvs=uv[fi];for(var k=0;k<f.length;k++){var t=uvs[k];vt.push(t);uvi.push(vt.length);}faceUV.push(uvi);});
    vt.forEach(function(t){s+='vt '+t[0].toFixed(5)+' '+t[1].toFixed(5)+'\n';});
    F.forEach(function(f,fi){var uvi=faceUV[fi];s+='f '+f.map(function(x,k){return map[x]+'/'+uvi[k];}).join(' ')+'\n';});
    downloadText(s,'model.obj');
    if(textureDataURL){downloadText('newmtl texture_material\nmap_Kd texture.png\nKd 1 1 1\n','model.mtl');downloadDataURL(textureDataURL,'texture.png');}
    flash(textureDataURL?'OBJ/MTL/texture':'OBJ書き出し');
  }

  function save(){try{localStorage.setItem('lowpoly_kone',JSON.stringify(M));if(textureDataURL)localStorage.setItem('lowpoly_kone_tex',textureDataURL);else localStorage.removeItem('lowpoly_kone_tex');flash('保存した');}catch(e){flash('保存できず');}}
  function load(){try{var s=localStorage.getItem('lowpoly_kone');if(s){snapshot();M=JSON.parse(s);clearSel();rebuild();var tex=localStorage.getItem('lowpoly_kone_tex');if(tex)applyTextureDataURL(tex);flash('読み込んだ');}else flash('保存が無い');}catch(e){flash('読込できず');}}
  var flashEl=null;function flash(msg){if(!flashEl){flashEl=document.createElement('div');flashEl.style.cssText='position:fixed;left:50%;top:54%;transform:translateX(-50%);z-index:30;font-family:monospace;font-size:.7rem;letter-spacing:.1em;color:#e0a23a;background:rgba(8,8,7,.9);border:1px solid #2a2824;padding:10px 18px;pointer-events:none;opacity:0;transition:opacity .2s';document.body.appendChild(flashEl);}flashEl.textContent=msg;flashEl.style.opacity='1';clearTimeout(flashEl._t);flashEl._t=setTimeout(function(){flashEl.style.opacity='0';},900);}

  var orbiting=false,lastX=0,lastY=0,pinch=null;
  function onStart(touches){if(touches.length===1){var p=screenXY(touches[0]),picked=false;if(elemMode==='vert'){var iv=pickVert(p);if(iv>=0){selVert=iv;updateSelVisual();beginDragVerts([iv],M.verts[iv]);picked=true;}}else if(elemMode==='edge'){var e=pickEdge(p);if(e){selEdge=e;updateSelVisual();beginDragVerts([e[0],e[1]],mid(e[0],e[1]));picked=true;}}else if(elemMode==='face'){var fa=pickFace(p);if(fa>=0){selFace=fa;updateSelVisual();var f=cleanFaceRefs(M.faces[fa]);beginDragVerts(f.slice(),faceCentroid(f));picked=true;}}else if(elemMode==='object'){var fo=pickFace(p);if(fo>=0){selFace=fo;var comp=componentFromFace(fo);updateSelVisual();beginDragVerts(comp.verts,vertsCentroid(comp.verts));picked=true;}}if(!picked){orbiting=true;lastX=p.x;lastY=p.y;}}else if(touches.length===2){orbiting=false;endDrag();var a=screenXY(touches[0]),b=screenXY(touches[1]);pinch={d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};}}
  function onMove(touches){if(touches.length===2&&pinch){var a=screenXY(touches[0]),b=screenXY(touches[1]),d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;if(pinch.d>0){camR*=pinch.d/d;camR=Math.max(1.2,Math.min(40,camR));}camTheta-=(cx-pinch.cx)*.005;camPhi-=(cy-pinch.cy)*.005;camPhi=Math.max(.12,Math.min(Math.PI-.12,camPhi));updateCam();pinch={d:d,cx:cx,cy:cy};return;}if(touches.length===1){var p=screenXY(touches[0]);if(drag)moveDrag(p);else if(orbiting){camTheta-=(p.x-lastX)*.006;camPhi-=(p.y-lastY)*.006;camPhi=Math.max(.12,Math.min(Math.PI-.12,camPhi));lastX=p.x;lastY=p.y;updateCam();}}}
  function onEnd(touches){if(touches.length===0){orbiting=false;endDrag();pinch=null;}else if(touches.length===1){pinch=null;var p=screenXY(touches[0]);lastX=p.x;lastY=p.y;}}
  canvas.addEventListener('touchstart',function(e){e.preventDefault();onStart(e.touches);},{passive:false});canvas.addEventListener('touchmove',function(e){e.preventDefault();onMove(e.touches);},{passive:false});canvas.addEventListener('touchend',function(e){e.preventDefault();onEnd(e.touches);},{passive:false});canvas.addEventListener('touchcancel',function(e){e.preventDefault();onEnd(e.touches);},{passive:false});
  var mouseDown=false;canvas.addEventListener('mousedown',function(e){mouseDown=true;onStart([e]);});window.addEventListener('mousemove',function(e){if(mouseDown)onMove([e]);});window.addEventListener('mouseup',function(){mouseDown=false;onEnd([]);});canvas.addEventListener('wheel',function(e){e.preventDefault();camR*=(e.deltaY>0?1.1:.9);camR=Math.max(1.2,Math.min(40,camR));updateCam();},{passive:false});

  function setMode(m){elemMode=m;clearSel();document.getElementById('mVert').classList.toggle('on',m==='vert');document.getElementById('mEdge').classList.toggle('on',m==='edge');document.getElementById('mFace').classList.toggle('on',m==='face');document.getElementById('mObj').classList.toggle('on',m==='object');}
  document.getElementById('mVert').onclick=function(){setMode('vert');};document.getElementById('mEdge').onclick=function(){setMode('edge');};document.getElementById('mFace').onclick=function(){setMode('face');};document.getElementById('mObj').onclick=function(){setMode('object');};
  function setAxis(ax){lockAxis=(lockAxis===ax?null:ax);document.getElementById('aX').classList.toggle('on',lockAxis==='x');document.getElementById('aY').classList.toggle('on',lockAxis==='y');document.getElementById('aZ').classList.toggle('on',lockAxis==='z');}
  document.getElementById('aX').onclick=function(){setAxis('x');};document.getElementById('aY').onclick=function(){setAxis('y');};document.getElementById('aZ').onclick=function(){setAxis('z');};
  document.getElementById('opExtrude').onclick=function(){if(elemMode==='face')extrude();else if(elemMode==='edge')extrudeEdge();else{setMode('face');flash('面か辺を選んでね');}};
  document.getElementById('opSub').onclick=function(){if(elemMode!=='face'){setMode('face');flash('面を選んでね');return;}subdivide();};
  document.getElementById('opDel').onclick=delSelection; document.getElementById('opUndo').onclick=undo; document.getElementById('opRedo').onclick=redo;
  document.getElementById('opMirror').onclick=function(){mirrorOn=!mirrorOn;document.getElementById('opMirror').classList.toggle('on',mirrorOn);rebuild();flash(mirrorOn?'ミラー ON':'ミラー OFF');};
  document.getElementById('opCenter').onclick=center; document.getElementById('opWeld').onclick=weld;
  function clearTexture(){texture=null;textureDataURL=null;mat.map=null;mat.color.setHex(0xb8b2a2);mat.needsUpdate=true;}
  function boundsOfVerts(vs){if(!vs.length)return null;var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];vs.forEach(function(v){for(var k=0;k<3;k++){if(v[k]<mn[k])mn[k]=v[k];if(v[k]>mx[k])mx[k]=v[k];}});return {min:mn,max:mx,center:[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2],size:[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]};}
  function frameModel(){var b=boundsOfVerts(M.verts);if(!b)return;target.set(b.center[0],b.center[1],b.center[2]);var diag=Math.sqrt(b.size[0]*b.size[0]+b.size[1]*b.size[1]+b.size[2]*b.size[2]);camR=Math.max(4,diag*1.35);updateCam();}
  function appendPreset(){endDrag();snapshot();var sel=document.getElementById('preset'),src=presetModel(sel.value);var cb=boundsOfVerts(M.verts),sb=boundsOfVerts(src.verts);var base=M.verts.length;var targetX=cb?cb.max[0]+sb.size[0]/2+0.65:0;var off=[targetX-sb.center[0],-sb.center[1],-sb.center[2]];src.verts.forEach(function(v){M.verts.push([v[0]+off[0],v[1]+off[1],v[2]+off[2]]);});src.faces.forEach(function(f){M.faces.push(f.map(function(i){return base+i;}));});clearSel();setMode('object');selFace=M.faces.length-src.faces.length;rebuild();frameModel();flash('追加：'+sel.options[sel.selectedIndex].text);}
  function applyPreset(){
    endDrag();
    snapshot();
    var sel=document.getElementById('preset');
    M=presetModel(sel.value);
    clearTexture();
    if(mirrorOn){mirrorOn=false;document.getElementById('opMirror').classList.remove('on');}
    clearSel();
    target.set(0,0,0);camR=6;camTheta=.7;camPhi=1.0;updateCam();
    rebuild();
    flash('形：'+sel.options[sel.selectedIndex].text);
  }
  document.getElementById('opPreset').onclick=applyPreset;
  document.getElementById('opAdd').onclick=appendPreset;
  document.getElementById('opUV').onclick=drawUVGuide; document.getElementById('opTex').onclick=chooseTexture; document.getElementById('opSave').onclick=save; document.getElementById('opLoad').onclick=load; document.getElementById('opObj').onclick=exportOBJ;
  document.getElementById('helpBtn').onclick=function(){document.getElementById('help').classList.add('on');};document.getElementById('helpClose').onclick=function(){document.getElementById('help').classList.remove('on');};
  function resize(){var w=window.innerWidth,h=window.innerHeight;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h,false);canvas.style.width=w+'px';canvas.style.height=h+'px';camera.aspect=w/h;camera.updateProjectionMatrix();}
  window.addEventListener('resize',resize);resize();updateCam();rebuild();(function loop(){requestAnimationFrame(loop);renderer.render(scene,camera);})();document.getElementById('help').classList.add('on');
})();
</script>
</body>
</html>