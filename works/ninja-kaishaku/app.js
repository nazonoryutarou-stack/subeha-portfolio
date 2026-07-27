(function(){
  'use strict';
  const root=document.documentElement;
  const cases=[...document.querySelectorAll('.case-file')];
  const reveals=[...document.querySelectorAll('.reveal')];
  const deathCount=document.getElementById('deathCount');
  const currentName=document.getElementById('currentName');
  const progressBar=document.getElementById('progressBar');
  let fontScale=1;
  let motionOff=false;

  function setFont(delta){
    fontScale=Math.min(1.25,Math.max(.88,fontScale+delta));
    root.style.setProperty('--font-scale',fontScale.toFixed(2));
    localStorage.setItem('ninja-font',fontScale);
  }
  document.getElementById('fontDown').addEventListener('click',()=>setFont(-.06));
  document.getElementById('fontUp').addEventListener('click',()=>setFont(.06));

  const saved=Number(localStorage.getItem('ninja-font'));
  if(saved>=.88&&saved<=1.25){fontScale=saved;root.style.setProperty('--font-scale',saved)}

  const motionBtn=document.getElementById('motionToggle');
  motionBtn.addEventListener('click',()=>{
    motionOff=!motionOff;
    document.body.classList.toggle('motion-off',motionOff);
    reveals.forEach(el=>el.classList.toggle('is-visible',motionOff||el.classList.contains('seen')));
    motionBtn.textContent=motionOff?'動':'止';
    motionBtn.setAttribute('aria-label',motionOff?'演出を再開':'演出を停止');
  });

  if('IntersectionObserver' in window){
    const revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('seen','is-visible');
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -10%'});
    reveals.forEach(el=>revealObserver.observe(el));

    const caseObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      const n=Number(visible.target.dataset.case||0);
      deathCount.textContent=String(n).padStart(2,'0');
      currentName.textContent='FILE '+String(n).padStart(2,'0')+' / '+visible.target.dataset.name;
    },{threshold:[.15,.35,.6],rootMargin:'-20% 0px -55%'});
    cases.forEach(el=>caseObserver.observe(el));
  }else{
    reveals.forEach(el=>el.classList.add('is-visible'));
  }

  function updateProgress(){
    const h=document.documentElement;
    const max=h.scrollHeight-h.clientHeight;
    const p=max>0?h.scrollTop/max:0;
    progressBar.style.width=(p*100).toFixed(2)+'%';
    if(h.scrollTop>document.getElementById('interpretation').offsetTop-300){
      deathCount.textContent='32';
      currentName.textContent='解釈確定';
    }
  }
  addEventListener('scroll',updateProgress,{passive:true});
  addEventListener('resize',updateProgress);
  updateProgress();
})();