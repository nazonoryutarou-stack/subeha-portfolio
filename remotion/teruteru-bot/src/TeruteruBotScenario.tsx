import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {TeruteruBotCG2} from './TeruteruBotCG2';

const C={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const fade=(f:number,a:number,b:number,c:number,d:number)=>interpolate(f,[a,b,c,d],[0,1,1,0],C);

const Mono:React.CSSProperties={fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'};

export const TeruteruBotScenario:React.FC=()=>{
 const f=useCurrentFrame();
 const intro=fade(f,0,10,78,90);
 const normal=fade(f,88,100,198,210);
 const failure=fade(f,205,216,292,300);
 const punch=fade(f,300,312,350,360);
 const end=interpolate(f,[360,374],[0,1],C);
 const shake=f>=218&&f<286?((f%4)-1.5)*4:0;
 const blackout=(f>=246&&f<251)||(f>=266&&f<273)||(f>=286&&f<292);
 const warningBlink=f>=220&&f<300&&Math.floor(f/7)%2===0;

 return <AbsoluteFill style={{background:'#020304',overflow:'hidden'}}>
   <Audio src={staticFile('audio/teruteru-soundtrack.wav')} volume={1}/>

   <div style={{position:'absolute',inset:0,translate:`${shake}px 0px`,filter:blackout?'brightness(0.08) contrast(1.8)':'none'}}>
     <TeruteruBotCG2/>
   </div>

   {/* Old CG captions are deliberately buried; this gradient makes the story UI dominant. */}
   <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(0,0,0,.32) 0%,transparent 28%,transparent 62%,rgba(0,0,0,.92) 89%,#020304 100%)'}}/>

   {/* 0–3 sec: establish that this is a formal rain test. */}
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:intro,pointerEvents:'none'}}>
     <div style={{width:610,border:'1px solid rgba(238,244,241,.55)',padding:'26px 28px',color:'#f1f4f0',background:'rgba(2,4,5,.52)',...Mono}}>
       <div style={{fontSize:15,letterSpacing:5,opacity:.68}}>FIELD TEST / WEATHER CONTROL UNIT</div>
       <div style={{marginTop:16,fontSize:31,fontWeight:800,letterSpacing:4}}>降雨対策機 TTB-01</div>
       <div style={{marginTop:12,fontSize:21,letterSpacing:5}}>雨天運用試験　開始</div>
       <div style={{marginTop:24,height:2,background:'rgba(240,245,240,.68)'}}/>
       <div style={{marginTop:14,fontSize:14,letterSpacing:3,opacity:.68}}>降水量 32 mm/h　／　外装防水試験</div>
     </div>
   </div>

   {/* 3–7 sec: it appears to be working. */}
   <div style={{position:'absolute',top:52,left:34,right:34,color:'#eef3ef',opacity:normal,textShadow:'0 2px 14px #000',...Mono}}>
     <div style={{display:'flex',justifyContent:'space-between',fontSize:16,letterSpacing:3,borderBottom:'1px solid rgba(238,244,241,.42)',paddingBottom:10}}>
       <span>TTB-01 / RAIN TEST</span><span>00:04:18</span>
     </div>
     <div style={{display:'flex',justifyContent:'space-between',marginTop:13,fontSize:19,letterSpacing:3}}>
       <span>降水量　32 mm/h</span><span style={{fontWeight:900}}>稼働状態　正常</span>
     </div>
   </div>
   <div style={{position:'absolute',left:0,right:0,bottom:70,textAlign:'center',color:'#f3f4ef',fontSize:18,letterSpacing:4,opacity:normal,textShadow:'0 3px 18px #000',...Mono}}>WEATHER CONTROL : ACTIVE</div>

   {/* 7–10 sec: failure becomes impossible to miss. */}
   <AbsoluteFill style={{background:warningBlink?'rgba(120,0,0,.16)':'transparent',opacity:failure}}/>
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:failure}}>
     <div style={{width:620,textAlign:'center',color:'#fff',background:'rgba(0,0,0,.72)',border:'2px solid rgba(255,255,255,.75)',padding:'34px 24px',...Mono}}>
       <div style={{fontSize:42,fontWeight:950,letterSpacing:5}}>SYSTEM FAILURE</div>
       <div style={{marginTop:15,fontSize:17,letterSpacing:5,opacity:.72}}>WATER INGRESS DETECTED</div>
       <div style={{marginTop:28,fontSize:27,fontWeight:900,letterSpacing:4}}>浸水を検知しました</div>
       <div style={{marginTop:14,fontSize:20,letterSpacing:4}}>稼働状態　異常</div>
     </div>
   </div>

   {/* 10–12 sec: hold the dead machine, then deliver the joke. */}
   <AbsoluteFill style={{background:`rgba(0,0,0,${punch*.44})`}}/>
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 46px',textAlign:'center',color:'#f8f8f3',fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontSize:45,fontWeight:900,letterSpacing:6,lineHeight:1.65,textShadow:'0 4px 30px #000',opacity:punch}}>
     機械化したため、<br/>雨に弱い。
   </div>

   {/* 12–15 sec: suddenly behave like a respectable product commercial. */}
   <AbsoluteFill style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f5f5f1',color:'#08090a',textAlign:'center',opacity:end}}>
     <div style={{font:'900 59px Arial,Helvetica,sans-serif',letterSpacing:8}}>TERUTERU BOT</div>
     <div style={{marginTop:19,font:'700 27px "Yu Mincho",serif',letterSpacing:6}}>てるてる坊主の上位機種。</div>
     <div style={{marginTop:48,font:'800 23px "Yu Mincho",serif',letterSpacing:7}}>受注生産</div>
     <div style={{position:'absolute',bottom:46,fontSize:13,letterSpacing:2,color:'#555752'}}>※屋外での使用は推奨されません。　※画像は一例です。</div>
   </AbsoluteFill>
 </AbsoluteFill>;
};
