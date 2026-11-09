/* Multiple independently placed and mixed audio clips, using the app's shared capture mixer. */
import {bound} from './compositor.mjs';
import {installTrackEQ} from './audio-eq.mjs';
export function audioClipGain(clip,t){
  const start=Number(clip.start)||0,d=Math.max(0,Number(clip.duration)||0);
  if(t<start||t>=start+d||clip.muted)return 0;
  const local=t-start,fadeIn=Math.max(0,Number(clip.fadeIn)||0),fadeOut=Math.max(0,Number(clip.fadeOut)||0);
  const a=fadeIn?Math.min(1,local/fadeIn):1;
  const b=fadeOut?Math.min(1,(d-local)/fadeOut):1;
  return bound(clip.volume??0.75,0,1)*Math.max(0,Math.min(a,b));
}
export function createMultiAudioEngine({state,getGraph}){
  const players=new Map();
  const sync=()=>{
    const tracks=state.project.audioTracks||[];
    for(const [id,play] of players)if(!tracks.some(t=>t.id===id)){
      play.el.pause();play.el.removeAttribute('src');play.el.load();play.gain?.disconnect();players.delete(id);
    }
    for(const track of tracks){
      const asset=state.assets.get(track.assetId);if(!asset||asset.type!=='audio')continue;
      let player=players.get(track.id);
      if(!player){
        const el=new Audio(asset.url);el.preload='auto';el.playsInline=true;
        player={el,gain:null,eq:null,connected:false};players.set(track.id,player);
      }
      const gainValue=audioClipGain(track,state.current);
      const active=state.playing&&gainValue>0;
      if(active&&!player.connected){
        try{
          const {audioCtx,mixer}=getGraph();
          if(audioCtx&&mixer){
            const node=audioCtx.createMediaElementSource(player.el);
            const gain=audioCtx.createGain();const eq=installTrackEQ(audioCtx,node,gain,audioCtx.destination,mixer);
            player.gain=gain;player.eq=eq;player.connected=true;
          }
        }catch(err){console.warn('Audio route',err);}
      }
      // audio.currentTime is relative to imported media, not the project timeline.
      const target=Math.max(0,(Number(track.offset)||0)+(state.current-(Number(track.start)||0)));
      if(gainValue>0&&Number.isFinite(target)&&Math.abs((player.el.currentTime||0)-target)>.20)try{player.el.currentTime=target;}catch{}
      if(player.eq)player.eq.update(track.eq);
      if(player.gain)player.gain.gain.value=gainValue;
      else player.el.volume=gainValue;
      if(active){if(player.el.paused)player.el.play().catch(()=>{});}
      else if(!player.el.paused)player.el.pause();
    }
  };
  const stop=()=>{for(const p of players.values())p.el.pause();};
  return {sync,stop,players};
}
