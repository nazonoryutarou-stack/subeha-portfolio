/** Minimal local WebGL OBJ renderer. Flat/vertex normals, diffuse + specular lighting. */
import {evaluateCG} from './obj-core.mjs';
const VS=`attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;void main(){vec4 w=uModel*vec4(aPos,1.);vWorld=w.xyz;vNormal=mat3(uModel)*aNormal;gl_Position=uMVP*vec4(aPos,1.);}`;
const FS=`precision mediump float;varying vec3 vNormal;varying vec3 vWorld;uniform vec3 uColor;uniform vec3 uLight;uniform vec3 uEye;void main(){vec3 n=normalize(vNormal);vec3 l=normalize(uLight-vWorld);float diff=max(dot(n,l),0.);vec3 h=normalize(l+normalize(uEye-vWorld));float spec=pow(max(dot(n,h),0.),24.);vec3 color=uColor*(.23+.78*diff)+vec3(.78)*spec*.33;gl_FragColor=vec4(pow(clamp(color,0.,1.),vec3(.92)),1.);}`;
const rad=n=>n*Math.PI/180;
export function multiply(a,b){const o=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];return o;}
export function identity(){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);}
export function perspective(fovy,aspect,near=.1,far=100){const f=1/Math.tan(fovy/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o;}
export function modelMatrix(p){const a=rad(p.yaw),b=rad(p.pitch),s=p.scale,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 return new Float32Array([s*ca,0,s*-sa,0, s*sa*sb,s*cb,s*ca*sb,0, s*sa*cb,s*-sb,s*ca*cb,0, p.x,p.y,0,1]);}
function viewMatrix(distance){const m=identity();m[14]=-distance;return m;}
function hex(v){const m=/^#([0-9a-f]{6})$/i.exec(v||'');if(!m)return [.68,.73,.78];return [1,3,5].map(n=>parseInt(m[1].slice(n-1,n+1),16)/255);}
function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
export function createOBJRenderer({width=405,height=720}={}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 if(!gl)return createSoftwareOBJRenderer(canvas);
 const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 const attrPos=gl.getAttribLocation(program,'aPos'),attrNor=gl.getAttribLocation(program,'aNormal');
 const un={mvp:gl.getUniformLocation(program,'uMVP'),model:gl.getUniformLocation(program,'uModel'),color:gl.getUniformLocation(program,'uColor'),light:gl.getUniformLocation(program,'uLight'),eye:gl.getUniformLocation(program,'uEye')};
 const meshes=new Map();
 function register(id,geometry){if(meshes.has(id))return;
 const v=gl.createBuffer(),n=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,geometry.positions,gl.STATIC_DRAW);
 gl.bindBuffer(gl.ARRAY_BUFFER,n);gl.bufferData(gl.ARRAY_BUFFER,geometry.normals,gl.STATIC_DRAW);meshes.set(id,{v,n,count:geometry.positions.length/3});}
 function render(scene,id,at,w,h){const mesh=meshes.get(id);if(!mesh)return null;
 const aspect=w/h,edge=Math.min(900,Math.max(w,h)),sizeW=Math.max(1,Math.round(w*edge/Math.max(w,h))),sizeH=Math.max(1,Math.round(h*edge/Math.max(w,h)));
 if(canvas.width!==sizeW||canvas.height!==sizeH){canvas.width=sizeW;canvas.height=sizeH;}
 gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const p=evaluateCG(scene,at),m=modelMatrix(p),pv=multiply(perspective(rad(44),aspect),viewMatrix(p.camera)),mvp=multiply(pv,m);
 gl.useProgram(program);gl.uniformMatrix4fv(un.mvp,false,mvp);gl.uniformMatrix4fv(un.model,false,m);
 gl.uniform3fv(un.color,new Float32Array(hex(scene.color)));gl.uniform3fv(un.light,new Float32Array([Math.cos(rad(p.light))*4,4,Math.sin(rad(p.light))*4+4]));gl.uniform3fv(un.eye,new Float32Array([0,0,p.camera]));
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.v);gl.vertexAttribPointer(attrPos,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(attrPos);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.n);gl.vertexAttribPointer(attrNor,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(attrNor);
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);gl.flush();return canvas;}
 function dispose(){for(const m of meshes.values()){gl.deleteBuffer(m.v);gl.deleteBuffer(m.n);}meshes.clear();gl.deleteProgram(program);}
 return {canvas,register,render,dispose};
}

/** Canvas2D software fallback for WebGL-disabled browsers; face-count limited. */
export function createSoftwareOBJRenderer(canvas=document.createElement('canvas')){
 const meshes=new Map(),c=canvas.getContext('2d',{alpha:true});if(!c)throw Error('2D描画が利用できません');
 const MAX_FACES=2400;
 return {canvas,backend:'canvas2d-fallback',register(id,geo){meshes.set(id,geo);},
 render(scene,id,at,w,h){const geo=meshes.get(id);if(!geo)return null;
  const edge=Math.min(780,Math.max(w,h));canvas.width=Math.max(1,Math.round(w*edge/Math.max(w,h)));canvas.height=Math.max(1,Math.round(h*edge/Math.max(w,h)));
  const W=canvas.width,H=canvas.height,p=evaluateCG(scene,at),a=rad(p.yaw),b=rad(p.pitch),ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),factor=H*.5/Math.tan(rad(22));
  c.clearRect(0,0,W,H);
  const tri=geo.positions,frames=[],stride=Math.max(1,Math.ceil(tri.length/9/MAX_FACES));const light=[Math.cos(rad(p.light))*.6,.7,Math.sin(rad(p.light))*.6+.7],color=hex(scene.color);
  function transform(i){let x=tri[i]*p.scale,y=tri[i+1]*p.scale,z=tri[i+2]*p.scale;
   const yy=y*cb-z*sb,zz=y*sb+z*cb,xx=x*ca+zz*sa,z2=-x*sa+zz*ca;
   return [xx+p.x,yy+p.y,z2];}
  for(let t=0;t<tri.length/9;t+=stride){const i=t*9,v=[transform(i),transform(i+3),transform(i+6)];const ds=v.map(x=>p.camera-x[2]);if(ds.some(d=>d<=.05))continue;
   const cross=[(v[1][1]-v[0][1])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][1]-v[0][1]),
    (v[1][2]-v[0][2])*(v[2][0]-v[0][0])-(v[1][0]-v[0][0])*(v[2][2]-v[0][2]),
    (v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0])];
   const len=Math.hypot(...cross)||1,lambert=Math.max(0,(cross[0]*light[0]+cross[1]*light[1]+cross[2]*light[2])/len),power=.25+.74*lambert;
   const points=v.map((x,j)=>[W/2+x[0]*factor/ds[j],H/2-x[1]*factor/ds[j]]),avg=ds.reduce((a,b)=>a+b,0)/3;
   frames.push({points,avg,fill:'rgb('+color.map(z=>Math.round(Math.min(255,z*255*power+22))).join(',')+')'});
  }
  frames.sort((a,b)=>b.avg-a.avg);
  for(const f of frames){c.beginPath();c.moveTo(...f.points[0]);c.lineTo(...f.points[1]);c.lineTo(...f.points[2]);c.closePath();c.fillStyle=f.fill;c.fill();}
  return canvas;
 },dispose(){meshes.clear();}};
}
