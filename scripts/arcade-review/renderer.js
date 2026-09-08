// QA ONLY: CPU painter for walking the exact production geometry in a browser
// whose WebGL is disabled. Not shipped, not a WebGL lighting or FPS benchmark.
import * as THREE from '../../arcade/vendor/three.module.min.js';
export class CanvasSceneRenderer {
  constructor({canvas}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.shadowMap={};this.info={render:{calls:0,triangles:0}};this.dpr=1;this.last=0;this.textures=new Map();}
  setPixelRatio(n){this.dpr=Math.min(n,1);}
  setSize(w,h){this.w=w;this.h=h;this.canvas.width=w*this.dpr;this.canvas.height=h*this.dpr;}
  render(scene,camera){
    const now=performance.now();if(now-this.last<150)return;this.last=now;
    const g=this.ctx,w=this.w,h=this.h;g.setTransform(this.dpr,0,0,this.dpr,0,0);g.globalAlpha=1;g.fillStyle=scene.background.getStyle();g.fillRect(0,0,w,h);
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const inverse=camera.matrixWorldInverse,projection=camera.projectionMatrix,e=projection.elements,faces=[];
    const drawMesh=(mesh,world)=>{
      const geo=mesh.geometry,mat=mesh.material;if(!geo.attributes.position||Array.isArray(mat))return;
      const pos=geo.attributes.position,uv=geo.attributes.uv,idx=geo.index;
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,world),v=[];
      for(let j=0;j<pos.count;j++){
        const q=new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(transform);
        v.push({x:q.x,y:q.y,z:q.z,u:uv?uv.getX(j):0,v:uv?1-uv.getY(j):0});
      }
      const count=idx?idx.count:pos.count;
      for(let j=0;j<count;j+=3){
        let verts=[v[idx?idx.getX(j):j],v[idx?idx.getX(j+1):j+1],v[idx?idx.getX(j+2):j+2]];
        const [a,b,c]=verts,ab=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),ac=new THREE.Vector3(c.x-a.x,c.y-a.y,c.z-a.z),normal=ab.cross(ac).normalize();
        const facing=normal.dot(new THREE.Vector3(-a.x,-a.y,-a.z));if(mat.side!==THREE.DoubleSide&&facing<=0)continue;
        if(verts.every(a=>a.z>-.08)||verts.every(a=>a.z<-45))continue;
        // Clip to the near plane before perspective division.
        const out=[];for(let k=0;k<3;k++){
          const a=verts[k],b=verts[(k+1)%3],ain=a.z<=-.08,bin=b.z<=-.08;
          if(ain)out.push(a);if(ain!==bin){const t=(-.08-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:-.08,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
        }
        if(out.length<3)continue;
        const worldN=normal.clone().transformDirection(camera.matrixWorld);if(facing<0)worldN.negate();
        const shade=mat.isMeshBasicMaterial?1:Math.min(1,.47+.4*Math.max(0,worldN.y)+.25*Math.max(0,worldN.z*.6-worldN.x*.3));
        for(let k=1;k<out.length-1;k++){
          const tri=[out[0],out[k],out[k+1]].map(a=>({...a,sx:w/2+a.x/(-a.z)*e[0]*w/2,sy:h/2-a.y/(-a.z)*e[5]*h/2}));
          if(tri.every(a=>a.sx<0)||tri.every(a=>a.sx>w)||tri.every(a=>a.sy<0)||tri.every(a=>a.sy>h))continue;
          faces.push({tri,mat,shade,depth:-(out[0].z+out[k].z+out[k+1].z)/3});
        }
      }
    };
    scene.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.visible)return;
      if(mesh.isInstancedMesh){const instance=new THREE.Matrix4(),world=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);drawMesh(mesh,world);}}
      else drawMesh(mesh,mesh.matrixWorld);
    });
    faces.sort((a,b)=>b.depth-a.depth);this.info.render.triangles=faces.length;this.info.render.calls=faces.length;
    for(const f of faces){
      const [a,b,c]=f.tri,mat=f.mat;
      g.save();g.beginPath();g.moveTo(a.sx,a.sy);g.lineTo(b.sx,b.sy);g.lineTo(c.sx,c.sy);g.closePath();g.clip();g.globalAlpha=mat.transparent?mat.opacity:1;
      const source=mat.map?.image;
      if(source?.width){
        const sw=source.width,sh=source.height;
        const x0=a.u*sw,y0=a.v*sh,x1=b.u*sw,y1=b.v*sh,x2=c.u*sw,y2=c.v*sh;
        const determinant=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
        if(Math.abs(determinant)>.00001){
          const A=((b.sx-a.sx)*(y2-y0)-(c.sx-a.sx)*(y1-y0))/determinant;
          const B=((b.sy-a.sy)*(y2-y0)-(c.sy-a.sy)*(y1-y0))/determinant;
          const C=((c.sx-a.sx)*(x1-x0)-(b.sx-a.sx)*(x2-x0))/determinant;
          const D=((c.sy-a.sy)*(x1-x0)-(b.sy-a.sy)*(x2-x0))/determinant;
          g.transform(A,B,C,D,a.sx-A*x0-C*y0,a.sy-B*x0-D*y0);g.drawImage(source,0,0);
        }
      }else{g.fillStyle=mat.color.getStyle();g.fillRect(0,0,w,h);}
      g.restore();g.save();g.beginPath();g.moveTo(a.sx,a.sy);g.lineTo(b.sx,b.sy);g.lineTo(c.sx,c.sy);g.closePath();
      if(!mat.transparent){g.fillStyle=`rgba(0,0,0,${1-f.shade})`;g.fill();
        const fog=THREE.MathUtils.clamp((f.depth-12)/32,0,.82);if(fog){g.fillStyle=`rgba(89,99,79,${fog})`;g.fill();}}
      g.restore();
    }
  }
}
