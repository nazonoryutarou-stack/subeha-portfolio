/* SUBEHA CUT — original WebGL1 optical post-process for clip FX.
 * Captures a separate source bitmap: never draws a canvas back onto itself.
 * Uses a lightweight CPU Canvas2D approximation if the GPU is unavailable.
 */
export const OPTICAL_TYPES=Object.freeze([
 'chromatic','lenswarp','displace','ripple','halation',
 'anamorphic','kaleido','focusblur','rgb','prism-shift'
]);
export const OPTICAL_LABELS=Object.freeze({
 chromatic:'色収差レンズ',lenswarp:'広角レンズ',displace:'波状変位',
 ripple:'水面の屈折',halation:'光のにじみ',anamorphic:'横長レンズフレア',
 kaleido:'万華鏡',focusblur:'周辺ぼかし',rgb:'RGB分離', 'prism-shift':'プリズム屈折'
});
export const OPTICAL_PARAMS=Object.freeze({
 angle:{label:'方向',min:-180,max:180,step:1,default:0},
 frequency:{label:'細かさ',min:1,max:18,step:.5,default:7},
 spread:{label:'広がり',min:.05,max:1,step:.01,default:.5},
 centerX:{label:'中心 X',min:0,max:1,step:.01,default:.5},
 centerY:{label:'中心 Y',min:0,max:1,step:.01,default:.5}
});
const modes=Object.freeze(Object.fromEntries(OPTICAL_TYPES.map((key,index)=>[key,index+1])));
const finite=(v,defaultValue)=>v===undefined||v===null?defaultValue:Number.isFinite(Number(v))?Number(v):defaultValue;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
export function opticalSettings(type,amount=.5,options={}){
 const o=options&&typeof options==='object'?options:{};
 return {
  mode:modes[type]||0,intensity:clamp(amount,0,1),
  angle:clamp(o.angle,-180,180)*Math.PI/180,
  frequency:clamp(o.frequency,1,18),
  spread:clamp(o.spread,.05,1),
  centerX:clamp(o.centerX,0,1),centerY:clamp(o.centerY,0,1)
 };
}
const vertex=`
attribute vec2 aPosition;
varying vec2 vUV;
void main(){
 vUV=(aPosition+1.0)*0.5;
 gl_Position=vec4(aPosition,0.0,1.0);
}`;
const fragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uSource;
uniform vec2 uSize;
uniform float uMode;
uniform float uIntensity;
uniform float uAngle;
uniform float uFrequency;
uniform float uSpread;
uniform float uTime;
uniform vec2 uCenter;
const float PI=3.141592653589793;
vec4 sampleImage(vec2 uv){return texture2D(uSource,clamp(uv,vec2(0.001),vec2(0.999)));}
float luma(vec3 rgb){return dot(rgb,vec3(0.2126,0.7152,0.0722));}
void main(){
 vec2 uv=vUV,delta=uv-uCenter;
 vec2 aspect=vec2(uSize.x/uSize.y,1.0);
 float a=uIntensity,s=uSpread;
 vec2 dir=vec2(cos(uAngle),sin(uAngle));
 float radius=length(delta*aspect),phase=uTime;
 vec4 src=sampleImage(uv),outColor=src;
 if(uMode<1.5){
  float shift=a*(0.002+0.020*s);
  vec2 off=dir*shift;
  outColor=vec4(sampleImage(uv+off).r,src.g,sampleImage(uv-off).b,src.a);
 }else if(uMode<2.5){
  float k=a*0.7*s;vec2 warped=uCenter+delta*(1.0+k*radius*radius);
  outColor=mix(src,sampleImage(warped),a);
 }else if(uMode<3.5){
  vec2 disp=vec2(
    sin(uv.y*(uFrequency*14.0)+phase*2.6),
    cos(uv.x*(uFrequency*10.0)-phase*1.8)
  )*(0.004+0.032*s)*a;
  outColor=sampleImage(uv+disp);
 }else if(uMode<4.5){
  float wave=sin(radius*(uFrequency*42.0)-phase*8.0);
  vec2 n=normalize(delta+vec2(0.00001));
  outColor=sampleImage(uv+n*wave*a*(0.002+0.012*s));
 }else if(uMode<5.5){
  vec3 glow=vec3(0.0);vec2 px=1.0/uSize;
  for(int i=0;i<8;i++){
   float theta=float(i)*PI*.25;
   vec2 v=vec2(cos(theta),sin(theta))*px*(4.0+18.0*s);
   vec3 sampleRgb=sampleImage(uv+v).rgb;
   glow+=sampleRgb*max(0.0,luma(sampleRgb)-0.45)/8.0;
  }
  outColor=vec4(min(vec3(1.0),src.rgb+glow*vec3(1.4,.55,.22)*a*2.8),src.a);
 }else if(uMode<6.5){
  vec3 streak=vec3(0.0);
  for(int i=0;i<9;i++){
   float dx=(float(i)-4.0)/4.0;
   vec3 tap=sampleImage(uv+dir*dx*(0.03+0.23*s)).rgb;
   streak+=tap*max(0.0,luma(tap)-.62)/9.0;
  }
  outColor=vec4(min(vec3(1.0),src.rgb+streak*vec3(.55,.8,1.45)*a*4.0),src.a);
 }else if(uMode<7.5){
  vec2 pos=(uv-uCenter)*aspect;float angle=atan(pos.y,pos.x)+uAngle;
  float sectors=floor(3.0+uFrequency);
  float interval=PI*2.0/sectors;
  float folded=abs(mod(angle,2.0*interval)-interval);
  vec2 kaleido=uCenter+vec2(cos(folded),sin(folded))*length(pos)/aspect;
  outColor=mix(src,sampleImage(kaleido),a);
 }else if(uMode<8.5){
  float blur=clamp((radius-s*.42)*3.5,0.0,1.0)*a;
  vec3 mixed=src.rgb;
  for(int i=0;i<8;i++){
   float theta=float(i)*PI*.25;
   vec2 jitter=vec2(cos(theta),sin(theta))/uSize*(2.0+14.0*blur);
   mixed+=sampleImage(uv+jitter).rgb;
  }
  outColor=vec4(mix(src.rgb,mixed/9.0,blur),src.a);
 }else if(uMode<9.5){
  vec2 off=dir*(.003+.035*s)*a;
  vec3 separated=vec3(sampleImage(uv+off).r,src.g,sampleImage(uv-off).b);
  outColor=vec4(mix(src.rgb,separated*vec3(1.10,.98,1.10),a),src.a);
 }else if(uMode<10.5){
  float band=sin(dot(delta,vec2(dir.y,-dir.x))*uFrequency*18.0+phase*1.3);
  vec2 wedge=dir*(.001+.026*s)*band*a;
  vec3 refracted=vec3(sampleImage(uv+wedge*1.5).r,sampleImage(uv+wedge*.3).g,sampleImage(uv-wedge).b);
  outColor=vec4(refracted,src.a);
 }
 gl_FragColor=outColor;
}`;
let state=null,gpuBlocked=false,software=null;
function shader(gl,type,source){
 const value=gl.createShader(type);
 gl.shaderSource(value,source);gl.compileShader(value);
 if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)){
  const err=gl.getShaderInfoLog(value)||'shader compile failed';gl.deleteShader(value);throw new Error(err);
 }
 return value;
}
function createGPU(){
 if(gpuBlocked||typeof document==='undefined')return null;
 if(state&&!state.gl.isContextLost())return state;
 state=null;
 try{
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:false,depth:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl){gpuBlocked=true;return null;}
  const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
  const program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'link failed');
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  for(const [name,value] of [
   [gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],
   [gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]
  ])gl.texParameteri(gl.TEXTURE_2D,name,value);
  const uniforms={};
  for(const name of ['uSource','uSize','uMode','uIntensity','uAngle','uFrequency','uSpread','uTime','uCenter'])uniforms[name]=gl.getUniformLocation(program,name);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state=null;});
  state={canvas,gl,program,buffer,texture,uniforms};
  return state;
 }catch(e){
  console.warn('SUBEHA CUT optical GPU unavailable:',e);
  gpuBlocked=true;return null;
 }
}
function capture(surface){
 if(typeof document==='undefined')return null;
 const w=Math.max(2,surface.width),h=Math.max(2,surface.height);
 const scale=Math.min(1,960/Math.max(w,h),Math.sqrt(640000/(w*h)));
 const width=Math.max(2,Math.round(w*scale)),height=Math.max(2,Math.round(h*scale));
 if(!software){const canvas=document.createElement('canvas');software={canvas,ctx:canvas.getContext('2d')};}
 if(!software.ctx)return null;
 if(software.canvas.width!==width)software.canvas.width=width;
 if(software.canvas.height!==height)software.canvas.height=height;
 software.ctx.clearRect(0,0,width,height);
 software.ctx.drawImage(surface,0,0,width,height);
 return {canvas:software.canvas,width,height};
}
function gpuPass(snapshot,settings,time){
 const gpu=createGPU();
 if(!gpu)return null;
 const {canvas,gl,program,buffer,texture,uniforms:u}=gpu;
 if(canvas.width!==snapshot.width)canvas.width=snapshot.width;
 if(canvas.height!==snapshot.height)canvas.height=snapshot.height;
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 const position=gl.getAttribLocation(program,'aPosition');
 gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,snapshot.canvas);
 gl.uniform1i(u.uSource,0);
 gl.uniform2f(u.uSize,canvas.width,canvas.height);
 gl.uniform1f(u.uMode,settings.mode);
 gl.uniform1f(u.uIntensity,settings.intensity);
 gl.uniform1f(u.uAngle,settings.angle);
 gl.uniform1f(u.uFrequency,settings.frequency);
 gl.uniform1f(u.uSpread,settings.spread);
 gl.uniform1f(u.uTime,time);
 gl.uniform2f(u.uCenter,settings.centerX,settings.centerY);
 gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 return canvas;
}
function approximate(ctx,snapshot,type,settings,time){
 const w=snapshot.width,h=snapshot.height,src=snapshot.canvas,a=settings.intensity;
 const shift=Math.max(1,Math.round(a*w*.015));
 ctx.globalAlpha=1;ctx.filter='none';ctx.globalCompositeOperation='source-over';
 ctx.drawImage(src,0,0,w,h);
 if(type==='halation'||type==='anamorphic'){
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.5;
  ctx.filter='blur('+Math.ceil(2+12*settings.spread)+'px) brightness(1.2)';
  ctx.drawImage(src,0,0,w,h);return;
 }
 if(type==='focusblur'){
  ctx.globalAlpha=a*.6;ctx.filter='blur('+Math.ceil(3+14*settings.spread)+'px)';
  ctx.drawImage(src,0,0,w,h);return;
 }
 if(type==='lenswarp'||type==='kaleido'){
  ctx.globalAlpha=a*.5;ctx.translate(w*.5,h*.5);
  const scale=type==='lenswarp'?1+a*.09:1+a*.04;
  ctx.scale(scale,scale);ctx.drawImage(src,-w*.5,-h*.5,w,h);return;
 }
 if(type==='displace'||type==='ripple'){
  ctx.globalAlpha=a*.62;const slices=18,bh=h/slices;
  for(let i=0;i<slices;i++){
   const y=i*bh,offset=Math.sin(i*settings.frequency*.39+time*3)*shift*settings.spread;
   ctx.drawImage(src,0,y,w,bh,offset,y,w,bh);
  }
  return;
 }
 // RGB separation, chromatic aberration and prism fallback
 ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.28;
 ctx.filter='hue-rotate(95deg)';ctx.drawImage(src,shift,0,w,h);
 ctx.filter='hue-rotate(265deg)';ctx.drawImage(src,-shift,0,w,h);
}
export function applyOpticalFx(ctx,surface,type,amount=.5,time=0,options={}){
 if(!OPTICAL_TYPES.includes(type)||!ctx||!surface||amount<=0)return false;
 const settings=opticalSettings(type,amount,options);
 let snapshot;
 try{snapshot=capture(surface);}catch(e){console.warn('SUBEHA CUT optical capture unavailable:',e);return false;}
 if(!snapshot)return false;
 let output=null;
 try{output=gpuPass(snapshot,settings,Number(time)||0);}
 catch(e){gpuBlocked=true;console.warn('SUBEHA CUT optical GPU fallback:',e);}
 ctx.save();
 try{
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
  if(output)ctx.drawImage(output,0,0,surface.width,surface.height);
  else{
   // Keep the original safe at native resolution, then render only the additive
   // approximation from the separate immutable capture surface.
   ctx.save();
   try{
    ctx.scale(surface.width/snapshot.width,surface.height/snapshot.height);
    approximate(ctx,snapshot,type,settings,Number(time)||0);
   }finally{ctx.restore();}
  }
 }finally{ctx.restore();}
 return true;
}
