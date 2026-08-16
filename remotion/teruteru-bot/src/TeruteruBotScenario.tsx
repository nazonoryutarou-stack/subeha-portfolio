import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {TeruteruBotCG2} from './TeruteruBotCG2';

const C={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const fade=(f:number,a:number,b:number,c:number,d:number)=>interpolate(f,[a,b,c,d],[0,1,1,0],C);

const Telemetry:React.FC<{frame:number}>=({frame})=>{
 const normal=frame<185;
 const status=normal?'正常':'異常';
 const blink=!normal && Math.floor(frame/8)%2===0;
 return <div style={{position:'absolute',top:58,left:38,right:38,color:'#eef3f1',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:18,letterSpacing:2,textShadow:'0 2px 12px #000',opacity:fade(frame,8,18,252,268)}}>
   <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid rgba(240,245,242,.38)',paddingBottom:10}}><span>降雨対策機　試験運用中</span><span>TTB-01</span></div>
   <div style={{marginTop:12,display:'flex',justifyContent:'space-between'}}><span>降水量　32 mm/h</span><span style={{fontWeight:800,opacity:blink?.45:1}}>稼働状態　{status}</span></div>
  </div>;
};

export const TeruteruBotScenario:React.FC=()=>{
 const frame=useCurrentFrame();
 const failure=fade(frame,178,188,265,278);
 const punch=fade(frame,274,290,346,360);
 const end=interpolate(frame,[360,378],[0,1],C);
 const flash=(frame===10||frame===11||frame===92)?0.55:0;
 return <AbsoluteFill style={{background:'#020304'}}>
   <TeruteruBotCG2/>
   <AbsoluteFill style={{background:`rgba(225,240,255,${flash})`,mixBlendMode:'screen'}}/>
   <AbsoluteFill style={{background:'linear-gradient(to bottom,transparent 70%,rgba(2,3,4,.96) 88%,#020304 100%)'}}/>
   {frame<278 && <Telemetry frame={frame}/>} 
   <div style={{position:'absolute',left:0,right:0,bottom:58,textAlign:'center',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:17,letterSpacing:3,color:'#f3f4f0',opacity:failure}}>
     <div style={{fontSize:13,letterSpacing:5,opacity:.62,marginBottom:10}}>SYSTEM FAILURE / WATER INGRESS</div>
     稼働状態　異常
   </div>
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 48px',textAlign:'center',color:'#f7f7f2',fontFamily:'"Yu Mincho","Hiragino Mincho ProN",serif',fontSize:38,fontWeight:800,letterSpacing:5,textShadow:'0 4px 26px #000',opacity:punch,background:'rgba(0,0,0,.20)'}}>機械化したため、<br/>雨に弱い。</div>
   <AbsoluteFill style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:`rgba(246,246,242,${end})`,color:'#08090a',textAlign:'center',opacity:end}}>
     <div style={{font:'900 57px Arial,sans-serif',letterSpacing:7}}>TERUTERU BOT</div>
     <div style={{marginTop:18,font:'700 26px "Yu Mincho",serif',letterSpacing:6}}>てるてる坊主の上位機種。</div>
     <div style={{marginTop:42,font:'700 23px "Yu Mincho",serif',letterSpacing:6}}>受注生産</div>
     <div style={{position:'absolute',bottom:44,fontSize:13,letterSpacing:2,color:'#5d5e5b'}}>※屋外での使用は推奨されません。　※画像は一例です。</div>
   </AbsoluteFill>
 </AbsoluteFill>;
};
