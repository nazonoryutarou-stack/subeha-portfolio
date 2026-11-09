/* Four hand-drawn variations for the one-fold clove crest.
   The original crest asset is preserved; the canvas only adds ritual ink. */
(function(){
  const button=document.getElementById("crestStage");
  const canvas=document.getElementById("inkCanvas");
  const label=document.getElementById("crestNote");
  if(!button || !canvas || !canvas.getContext) return;
  const ctx=canvas.getContext("2d");
  let mode=0;
  let side=460;
  let ratio=1;
  function random(seed){
    let state=seed >>> 0;
    return function(){state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
  }
  function resize(){
    ratio=Math.min(window.devicePixelRatio||1,2);
    const box=canvas.getBoundingClientRect();
    side=Math.max(120,Math.round(Math.min(box.width,box.height)));
    canvas.width=Math.round(box.width*ratio);
    canvas.height=Math.round(box.height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    paint();
  }
  function paint(){
    const w=canvas.width/ratio,h=canvas.height/ratio;
    const cx=w/2,cy=h/2;
    const rng=random(20261109+mode*991);
    ctx.clearRect(0,0,w,h);
    const ink=mode===3?"rgba(167,39,38,.65)":"rgba(24,21,17,.57)";
    ctx.strokeStyle=ink;
    ctx.fillStyle=ink;
    ctx.lineCap="round";
    if(mode===0){
      ctx.lineWidth=1.2;
      [0.34,0.4,0.46].forEach(function(r,i){ctx.beginPath();ctx.ellipse(cx,cy,w*r,h*r,-.22,i*.7,Math.PI*1.58+i*.2);ctx.stroke()});
    }
    if(mode===1){
      for(let j=0;j<25;j++){
        const a=(j/25)*Math.PI*2+rng()*.15;
        const d=w*(.26+rng()*.12);
        ctx.beginPath();ctx.lineWidth=1+rng()*4;
        ctx.moveTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);
        ctx.quadraticCurveTo(cx+Math.cos(a+.08)*w*.49,cy+Math.sin(a+.08)*w*.47,cx+Math.cos(a+.16)*w*.56,cy+Math.sin(a+.16)*w*.52);
        ctx.stroke();
      }
    }
    if(mode===2){
      ctx.lineWidth=2;
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3;
        ctx.beginPath();ctx.arc(cx,cy,w*(.26+k*.044),a-.42,a+.95);
        ctx.stroke();
      }
      for(let k=0;k<75;k++){
        const a=rng()*Math.PI*2;
        const r=w*(.19+rng()*.37);
        const rad=1+rng()*2.4;
        ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,rad,0,Math.PI*2);ctx.fill();
      }
    }
    if(mode===3){
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.ellipse(cx,cy,w*.43,h*.39,Math.PI/10,Math.PI*.15,Math.PI*1.75);
      ctx.stroke();
      for(let i=0;i<13;i++){
        const x=cx-w*.35+i*w*.06;
        ctx.beginPath();
        ctx.moveTo(x,cy-h*.46);
        ctx.lineTo(x+8*rng(),cy-h*(.43-rng()*.18));
        ctx.stroke();
      }
    }
    // Imperfect print: scattered dry-ink specks, controlled and repeatable.
    for(let i=0;i<45;i++){
      const a=rng()*Math.PI*2,rad=w*(.33+rng()*.25);
      const x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;
      const d=.4+rng()*1.3;
      ctx.beginPath();ctx.arc(x,y,d,0,Math.PI*2);ctx.fill();
    }
  }
  button.dataset.mode=String(mode);
  button.addEventListener("click",function(){
    mode=(mode+1)%4;
    button.dataset.mode=String(mode);
    label.textContent="一つ折れ丁子　/　0"+(mode+1);
    paint();
  });
  window.addEventListener("resize",resize,{passive:true});
  resize();
})();
