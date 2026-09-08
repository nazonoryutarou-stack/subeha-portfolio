// Local, quiet electrical/ventilation sound. No microphone, audio downloads or autoplay.
export function createSound(){
  let ctx,master,hum,filter,vent,on=false;
  async function toggle(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
      ctx=new AC();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
      hum=ctx.createOscillator();hum.type='sine';hum.frequency.value=100;
      const hg=ctx.createGain();hg.gain.value=.11;hum.connect(hg);hg.connect(master);hum.start();
      const second=ctx.createOscillator();second.frequency.value=50;
      const sg=ctx.createGain();sg.gain.value=.06;second.connect(sg);sg.connect(master);second.start();
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
      let seed=91;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed/2147483648)*.24;}
      vent=ctx.createBufferSource();vent.buffer=buffer;vent.loop=true;
      filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=580;filter.Q.value=.55;
      vent.connect(filter);filter.connect(master);vent.start();
    }
    on=!on;if(on)await ctx.resume();master.gain.setTargetAtTime(on?.28:0,ctx.currentTime,.18);return on;
  }
  function update(player,time,paused){
    if(!ctx)return;
    const near=1-Math.min(1,Math.abs(player.z-4)/10);
    hum.frequency.setTargetAtTime(100+Math.sin(time*.12)*.7,ctx.currentTime,.4);
    filter.frequency.setTargetAtTime(360+near*600+Math.sin(time*.17)*48,ctx.currentTime,.4);
    master.gain.setTargetAtTime(on&&!paused?.16+near*.12:0,ctx.currentTime,.25);
  }
  function suspend(){if(ctx)ctx.suspend().catch(()=>{});}
  async function resume(){if(ctx&&on)await ctx.resume().catch(()=>{});}
  return {toggle,update,suspend,resume};
}
