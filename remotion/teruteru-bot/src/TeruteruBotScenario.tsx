import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {TeruteruBotCG2} from './TeruteruBotCG2';

const C={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const fade=(f:number,a:number,b:number,c:number,d:number)=>interpolate(f,[a,b,c,d],[0,1,1,0],C);
const UI='"Noto Sans CJK JP",Arial,sans-serif';
const SERIF='"Noto Serif CJK JP","Noto Sans CJK JP",serif';

export const TeruteruBotScenario:React.FC=()=>{
 const f=useCurrentFrame();
 const intro=fade(f,0,10,78,90);
 const normal=fade(f,88,100,198,210);
 const failure=fade(f,205,216,292,300);
 const punchVisible=f>=300&&f<360;
 const punchOpacity=punchVisible?interpolate(f,[300,309,351,359],[0,1,1,0],C):0;
 const end=interpolate(f,[360,374],[0,1],C);
 const shake=f>=218&&f<286?((f%4)-1.5)*4:0;
 const blackout=(f>=246&&f<251)||(f>=266&&f<273)||(f>=286&&f<292);
 const warningBlink=f>=220&&f<300&&Math.floor(f/7)%2===0;

 return <AbsoluteFill style={{background:'#020304',overflow:'hidden'}}>
   <Audio src={staticFile('audio/teruteru-soundtrack.wav')} volume={1}/>
   <div style={{position:'absolute',inset:0,translate:`${shake}px 0px`,filter:blackout?'brightness(0.08) contrast(1.8)':'none'}}><TeruteruBotCG2/></div>
   <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(0,0,0,.30) 0%,transparent 28%,transparent 60%,rgba(0,0,0,.93) 90%,#020304 100%)'}}/>

   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:intro}}>
     <div style={{width:610,border:'1px solid rgba(238,244,241,.55)',padding:'26px 28px',color:'#f1f4f0',background:'rgba(2,4,5,.58)',fontFamily:UI}}>
       <div style={{fontSize:15,letterSpacing:5,opacity:.68}}>FIELD TEST / WEATHER CONTROL UNIT</div>
       <div style={{marginTop:16,fontSize:31,fontWeight:800,letterSpacing:3}}>降雨対策機 TTB-01</div>
       <div style={{marginTop:12,fontSize:21,fontWeight:700,letterSpacing:4}}>雨天運用試験　開始</div>
       <div style={{marginTop:24,height:2,background:'rgba(240,245,240,.68)'}}/>
       <div style={{marginTop:14,fontSize:14,letterSpacing:2,opacity:.72}}>降水量 32 mm/h　／　外装防水試験</div>
     </div>
   </div>

   <div style={{position:'absolute',top:52,left:34,right:34,color:'#eef3ef',opacity:normal,textShadow:'0 2px 14px #000',fontFamily:UI}}>
     <div style={{display:'flex',justifyContent:'space-between',fontSize:16,letterSpacing:3,borderBottom:'1px solid rgba(238,244,241,.42)',paddingBottom:10}}><span>TTB-01 / RAIN TEST</span><span>00:04:18</span></div>
     <div style={{display:'flex',justifyContent:'space-between',marginTop:13,fontSize:19,letterSpacing:2}}><span>降水量　32 mm/h</span><span style={{fontWeight:900}}>稼働状態　正常</span></div>
   </div>
   <div style={{position:'absolute',left:0,right:0,bottom:70,textAlign:'center',color:'#f3f4ef',fontSize:18,letterSpacing:4,opacity:normal,textShadow:'0 3px 18px #000',fontFamily:UI}}>WEATHER CONTROL : ACTIVE</div>

   <AbsoluteFill style={{background:warningBlink?'rgba(120,0,0,.17)':'transparent',opacity:failure}}/>
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:failure}}>
     <div style={{width:620,textAlign:'center',color:'#fff',background:'rgba(0,0,0,.76)',border:'2px solid rgba(255,255,255,.78)',padding:'34px 24px',fontFamily:UI}}>
       <div style={{fontSize:42,fontWeight:950,letterSpacing:5}}>SYSTEM FAILURE</div>
       <div style={{marginTop:15,fontSize:17,letterSpacing:5,opacity:.72}}>WATER INGRESS DETECTED</div>
       <div style={{marginTop:28,fontSize:27,fontWeight:900,letterSpacing:3}}>浸水を検知しました</div>
       <div style={{marginTop:14,fontSize:20,fontWeight:800,letterSpacing:3}}>稼働状態　異常</div>
     </div>
   </div>

   {punchVisible && <AbsoluteFill style={{background:'rgba(0,0,0,.56)',display:'flex',alignItems:'center',justifyContent:'center',opacity:punchOpacity}}>
     <div style={{padding:'34px 42px',textAlign:'center',color:'#fff',fontFamily:SERIF,fontSize:50,fontWeight:900,letterSpacing:5,lineHeight:1.65,textShadow:'0 4px 30px #000',borderTop:'1px solid rgba(255,255,255,.42)',borderBottom:'1px solid rgba(255,255,255,.42)'}}>機械化したため、<br/>雨に弱い。</div>
   </AbsoluteFill>}

   <AbsoluteFill style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f5f5f1',color:'#08090a',textAlign:'center',opacity:end}}>
     <div style={{font:'900 59px Arial,Helvetica,sans-serif',letterSpacing:8}}>TERUTERU BOT</div>
     <div style={{marginTop:19,fontFamily:SERIF,fontSize:27,fontWeight:800,letterSpacing:5}}>てるてる坊主の上位機種。</div>
     <div style={{marginTop:48,fontFamily:SERIF,fontSize:23,fontWeight:900,letterSpacing:6}}>受注生産</div>
     <div style={{position:'absolute',bottom:46,fontFamily:UI,fontSize:13,letterSpacing:1.5,color:'#555752'}}>※屋外での使用は推奨されません。　※画像は一例です。</div>
   </AbsoluteFill>
 </AbsoluteFill>;
};
