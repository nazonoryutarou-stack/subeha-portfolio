/* SUBEHA CUT 2.4: original GPU-shaded embossed typography.
 * This is a 2.5D silhouette/extrusion material renderer, NOT a true 3D mesh,
 * and does not reproduce Videoleap's shaders. The same pixels go into export.
 * WebGL 1 is used for broad Android Chrome support; Canvas2D is the fallback.
 */
import {layoutTitle,measuredLine,drawTitle,drawGlyphLine} from './title-render.mjs';
import {normalizedPbrTitle,pbrHexRgb} from './pbr-title-core.mjs';

const VS=[
 'attribute vec2 aPos;',
 'varying vec2 vUV;',
 'void main(){',
 ' vUV=(aPos+1.0)*0.5;',
 ' gl_Position=vec4(aPos,0.0,1.0);',
 '}'
].join('\n');

const FS=[
 'precision highp float;',
 'varying vec2 vUV;',
 'uniform sampler2D uMask;',
 'uniform vec2 uTexel;',
 'uniform vec3 uBase;',
 'uniform float uMetallic;',
 'uniform float uRoughness;',
 'uniform float uBump;',
 'uniform float uEnvironment;',
 'uniform float uBevel;',
 'uniform float uDepth;',
 'uniform float uTime;',
 'uniform float uHologram;',
 'uniform vec4 uLight1;',
 'uniform vec4 uLight2;',
 'uniform vec3 uLightColor1;',
 'uniform vec3 uLightColor2;',
 'const float PI=3.14159265359;',
 'float glyph(vec2 at){return texture2D(uMask,at).a;}',
 'vec3 shade(vec3 N,vec3 V,vec3 base,vec3 L,vec3 lightColor,float strength){',
 ' vec3 H=normalize(V+L);',
 ' float ndl=max(dot(N,L),0.0),ndv=max(dot(N,V),0.001),ndh=max(dot(N,H),0.001),vdh=max(dot(V,H),0.001);',
 ' float a=max(0.04,uRoughness*uRoughness),a2=a*a;',
 ' float d=a2/(PI*pow(ndh*ndh*(a2-1.0)+1.0,2.0)+0.0001);',
 ' float k=pow(uRoughness+1.0,2.0)/8.0;',
 ' float g1=ndl/(ndl*(1.0-k)+k+0.0001);',
 ' float g2=ndv/(ndv*(1.0-k)+k+0.0001);',
 ' vec3 f0=mix(vec3(0.04),base,uMetallic);',
 ' vec3 fresnel=f0+(1.0-f0)*pow(1.0-vdh,5.0);',
 ' vec3 specular=d*g1*g2*fresnel/(4.0*ndl*ndv+0.0001);',
 ' vec3 diffuse=(vec3(1.0)-fresnel)*(1.0-uMetallic)*base/PI;',
 ' return (diffuse+specular)*ndl*lightColor*strength;',
 '}',
 'void main(){',
 ' float face=glyph(vUV),side=0.0;',
 ' vec2 along=uTexel*vec2(0.7,-0.72)*uDepth;',
 ' for(int i=1;i<=12;i++){',
 '  float stepValue=float(i)/12.0;',
 '  side=max(side,glyph(vUV-along*stepValue));',
 ' }',
 ' float alpha=max(face,side);',
 ' if(alpha<0.003)discard;',
 ' vec2 eps=uTexel*max(1.0,uBevel);',
 ' float xm=glyph(vUV-vec2(eps.x,0.0)),xp=glyph(vUV+vec2(eps.x,0.0));',
 ' float ym=glyph(vUV-vec2(0.0,eps.y)),yp=glyph(vUV+vec2(0.0,eps.y));',
 ' vec2 edge=vec2(xm-xp,ym-yp);',
 ' vec3 front=normalize(vec3(edge*(0.4+uBump*1.8),0.9));',
 ' vec3 sideNormal=normalize(vec3(edge*(0.35+uBump*0.8)+vec2(-0.53,0.55),0.24));',
 ' float sideMix=1.0-smoothstep(0.04,0.9,face);',
 ' vec3 N=normalize(mix(front,sideNormal,sideMix));',
 ' vec3 V=vec3(0.0,0.0,1.0);',
 ' vec3 base=pow(max(vec3(0.002),uBase),vec3(2.2));',
 ' if(uHologram>0.5){',
 '  float spectral=sin(vUV.y*24.0+N.x*5.0+uTime*1.2);',
 '  vec3 rainbow=0.55+0.45*cos(vec3(0.0,2.094,4.188)+spectral*2.1+vUV.x*9.0);',
 '  base=mix(base,rainbow,0.52);',
 ' }',
 ' vec3 light=shade(N,V,base,normalize(uLight1.xyz),pow(uLightColor1,vec3(2.2)),uLight1.w);',
 ' light+=shade(N,V,base,normalize(uLight2.xyz),pow(uLightColor2,vec3(2.2)),uLight2.w);',
 ' vec3 reflected=reflect(-V,N);',
 ' float environmentBand=pow(0.5+0.5*cos(reflected.x*8.0+reflected.y*3.5+uTime),6.0);',
 ' vec3 ambient=mix(base*0.14,vec3(0.9,0.96,1.0)*(0.13+environmentBand*0.52),uMetallic);',
 ' vec3 linearRgb=ambient*uEnvironment+light;',
 ' linearRgb*=mix(1.0,0.58,sideMix);',
 ' gl_FragColor=vec4(pow(max(linearRgb,vec3(0.0)),vec3(1.0/2.2)),alpha);',
 '}'
].join('\n');

let gpu=null,unavailable=false;
const rasterCache=new Map();
function compile(gl,type,code){
 const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const info=gl.getShaderInfoLog(s)||'shader compile failure';
  gl.deleteShader(s);throw new Error(info);
 }
 return s;
}
function gpuContext(){
 if(unavailable||typeof document==='undefined')return null;
 if(gpu&&gpu.gl.isContextLost())gpu=null;
 if(gpu)return gpu;
 try{
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl){unavailable=true;return null;}
  const vs=compile(gl,gl.VERTEX_SHADER,VS),fs=compile(gl,gl.FRAGMENT_SHADER,FS);
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'program link failure');
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const uniforms={};
  for(const key of ['uMask','uTexel','uBase','uMetallic','uRoughness','uBump','uEnvironment','uBevel','uDepth','uTime','uHologram','uLight1','uLight2','uLightColor1','uLightColor2']){
   uniforms[key]=gl.getUniformLocation(program,key);
  }
  gpu={gl,canvas,program,buffer,texture,uniforms,lastTextureKey:null};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gpu=null;});
  return gpu;
 }catch(e){console.warn('SUBEHA CUT PBR GPU unavailable:',e);unavailable=true;return null;}
}
function rasterize(box){
 const margin=56,rasterW=box.w+margin*2,rasterH=box.h+margin*2;
 const factor=Math.min(1,900/rasterW,640/rasterH);
 const width=Math.max(2,Math.ceil(rasterW*factor)),height=Math.max(2,Math.ceil(rasterH*factor));
 const sig=JSON.stringify([box.lines,box.size,box.style.font,box.style.weight,box.spacing,box.lineHeight,box.style.align,box.w,box.h,width,height]);
 const saved=rasterCache.get(sig);
 if(saved){rasterCache.delete(sig);rasterCache.set(sig,saved);return saved;}
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const g=canvas.getContext('2d',{willReadFrequently:false});
 if(!g)return null;
 g.setTransform(factor,0,0,factor,0,0);g.translate(rasterW/2,rasterH/2);
 g.font=String(box.style.weight)+' '+box.size+'px '+box.style.font;
 g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffffff';
 for(let i=0;i<box.lines.length;i++){
  const line=box.lines[i],lw=measuredLine(g,line,box.spacing);
  let shift=0;
  if(box.style.align==='left')shift=-(box.w/2-box.padding)+lw/2;
  if(box.style.align==='right')shift=box.w/2-box.padding-lw/2;
  const y=(i-(box.lines.length-1)/2)*box.lineHeight;
  if(Math.abs(box.spacing)<.0001)g.fillText(line,shift,y);
  else drawGlyphLine(g,line,shift,y,box.spacing);
 }
 const entry={canvas,sig,width,height,factor,rasterW,rasterH};
 rasterCache.set(sig,entry);
 while(rasterCache.size>5)rasterCache.delete(rasterCache.keys().next().value);
 return entry;
}
function vecLight(light){
 const a=light.angle*Math.PI/180,z=light.elevation;
 const planar=Math.sqrt(Math.max(0,1-z*z));
 return [Math.cos(a)*planar,Math.sin(a)*planar,z,light.intensity];
}
function bindUniforms(state,mask,material,seconds){
 const {gl,uniforms:u,program,buffer,texture,canvas}=state;
 if(canvas.width!==mask.width||canvas.height!==mask.height){
  canvas.width=mask.width;canvas.height=mask.height;state.lastTextureKey=null;
 }
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 const location=gl.getAttribLocation(program,'aPos');
 gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
 if(state.lastTextureKey!==mask.sig){
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask.canvas);
  state.lastTextureKey=mask.sig;
 }
 gl.uniform1i(u.uMask,0);
 gl.uniform2f(u.uTexel,1/mask.width,1/mask.height);
 gl.uniform3fv(u.uBase,pbrHexRgb(material.color));
 gl.uniform1f(u.uMetallic,material.metallic);
 gl.uniform1f(u.uRoughness,material.roughness);
 gl.uniform1f(u.uBump,material.bumpiness);
 gl.uniform1f(u.uEnvironment,material.environment);
 gl.uniform1f(u.uBevel,material.bevel*mask.factor);
 gl.uniform1f(u.uDepth,material.depth*mask.factor);
 gl.uniform1f(u.uTime,seconds*material.spin*4);
 gl.uniform1f(u.uHologram,material.style==='hologram'?1:0);
 gl.uniform4fv(u.uLight1,vecLight(material.light1));
 gl.uniform4fv(u.uLight2,vecLight(material.light2));
 gl.uniform3fv(u.uLightColor1,pbrHexRgb(material.light1.color));
 gl.uniform3fv(u.uLightColor2,pbrHexRgb(material.light2.color));
 gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}
export function canUsePbrTitle(){return !!gpuContext();}
export function drawPbrTitle(ctx,canvas,item,localSeconds=0){
 if(!item?.text)return null;
 if(typeof document==='undefined')return drawTitle(ctx,canvas,item);
 const state=gpuContext();
 if(!state)return drawTitle(ctx,canvas,item);
 const box=layoutTitle(ctx,canvas,item);
 const mask=rasterize(box);
 if(!mask)return drawTitle(ctx,canvas,item);
 const material=normalizedPbrTitle(item);
 try{
  bindUniforms(state,mask,material,localSeconds);
  ctx.save();
  try{
   ctx.translate(box.x,box.y);ctx.rotate(box.rotation*Math.PI/180);ctx.globalAlpha*=box.style.opacity;
   if(box.style.box){
    ctx.save();
    try{
     ctx.fillStyle=box.style.boxColor;ctx.globalAlpha*=box.style.boxOpacity;
     ctx.beginPath();
     if(ctx.roundRect)ctx.roundRect(-box.w/2,-box.h/2,box.w,box.h,box.size*.2);
     else ctx.rect(-box.w/2,-box.h/2,box.w,box.h);
     ctx.fill();
    }finally{ctx.restore();}
   }
   ctx.shadowColor='rgba(0,0,0,.58)';
   ctx.shadowBlur=Math.min(26,material.depth*.75)*canvas.width/720;
   ctx.shadowOffsetX=material.depth*.36*canvas.width/720;
   ctx.shadowOffsetY=material.depth*.55*canvas.width/720;
   ctx.drawImage(state.canvas,-mask.rasterW/2,-mask.rasterH/2,mask.rasterW,mask.rasterH);
  }finally{ctx.restore();}
  return box;
 }catch(e){
  // Runtime WebGL failures must not leave the export canvas transformed, nor
  // spam every frame with the same exception.
  console.warn('SUBEHA CUT PBR renderer fallback:',e);
  unavailable=true;
  return drawTitle(ctx,canvas,item);
 }
}
