/** Pure manipulations for on-canvas 3D positioning. No pointer/DOM dependencies. */
export function moveCG(scene,dx,dy,width,height){
 const scale=Math.max(1,Math.min(width,height));
 return {...scene,x:Math.max(-3,Math.min(3,(scene.x||0)+dx/scale*3)),y:Math.max(-3,Math.min(3,(scene.y||0)-dy/scale*3))};
}
export function transformCG(scene,scaleRatio,deltaAngle){
 return {...scene,scale:Math.max(.1,Math.min(5,(scene.scale||1)*Math.max(.01,scaleRatio))),yaw:(scene.yaw||0)+deltaAngle*180/Math.PI};
}
