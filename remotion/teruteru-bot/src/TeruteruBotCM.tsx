import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';

const W='#f6f6f2';
const B='#050505';
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};

const Text:React.FC<{children:React.ReactNode;size?:number;from?:number;to?:number}> = ({children,size=78,from=0,to=60})=>{
  const frame=useCurrentFrame();
  return <div style={{
    opacity:interpolate(frame,[from,from+10,to-10,to],[0,1,1,0],clamp),
    translate:interpolate(frame,[from,from+16],['0px 24px','0px 0px'],{...clamp,easing:Easing.bezier(.16,1,.3,1)}),
    color:B,fontFamily:'serif',fontWeight:800,fontSize:size,letterSpacing:8,textAlign:'center',lineHeight:1.35
  }}>{children}</div>;
};

const BotGlyph:React.FC = ()=>{
  const frame=useCurrentFrame();
  return <div style={{
    width:620,height:760,position:'relative',
    scale:interpolate(frame,[0,90],[.97,1.025],{...clamp,easing:Easing.bezier(.2,.8,.2,1),output:'perceptual-scale'}),
  }}>
    <div style={{position:'absolute',left:185,top:70,width:250,height:220,border:'12px solid #111',borderRadius:'46% 54% 50% 50%',background:'#fff'}}/>
    <div style={{position:'absolute',left:130,top:255,width:360,height:330,border:'12px solid #111',borderRadius:'42% 42% 18% 18%',background:'#fff'}}/>
    {[0,1,2,3,4,5].map(i=><div key={i} style={{position:'absolute',left:40+i*92,top:470+(i%2)*22,width:130,height:10,background:'#111',rotate:`${-28+i*11}deg`,transformOrigin:'right center'}}/>)}
    {[0,1,2,3,4].map(i=><div key={'a'+i} style={{position:'absolute',left:210+i*55,top:40-(i%2)*18,width:8,height:110,background:'#111',rotate:`${-25+i*12}deg`,transformOrigin:'bottom center'}}/>)}
    <div style={{position:'absolute',left:288,top:155,width:38,height:38,borderRadius:'50%',background:'#111'}}/>
    {[0,1,2,3].map(i=><div key={'p'+i} style={{position:'absolute',left:190+(i%2)*165,top:330+Math.floor(i/2)*110,width:115,height:68,border:'8px solid #111',borderRadius:22,background:'#fff'}}/>)}
  </div>;
};

const Rain:React.FC = ()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill>{Array.from({length:45}).map((_,i)=>{
    const x=(i*97)%1080;
    const y=((i*171+frame*(20+i%7))%2250)-220;
    return <div key={i} style={{position:'absolute',left:x,top:y,width:3,height:100+(i%4)*20,background:'rgba(0,0,0,.18)',rotate:'12deg'}}/>;
  })}</AbsoluteFill>;
};

export const TeruteruBotCM:React.FC = ()=> (
  <AbsoluteFill style={{backgroundColor:W}}>
    <Sequence from={0} durationInFrames={80}>
      <AbsoluteFill style={{justifyContent:'center',alignItems:'center',padding:80}}><Text from={5} to={75}>雨は、まだ降るのか。</Text></AbsoluteFill>
    </Sequence>
    <Sequence from={80} durationInFrames={95}>
      <AbsoluteFill style={{justifyContent:'center',alignItems:'center'}}><BotGlyph/><div style={{position:'absolute',bottom:180,fontFamily:'serif',fontSize:44,letterSpacing:5}}>てるてる坊主は、次の段階へ。</div></AbsoluteFill>
    </Sequence>
    <Sequence from={175} durationInFrames={75}>
      <AbsoluteFill style={{justifyContent:'center',alignItems:'center'}}><Text from={0} to={72} size={126}>上 位 機 種</Text></AbsoluteFill>
    </Sequence>
    <Sequence from={250} durationInFrames={95}>
      <AbsoluteFill style={{justifyContent:'center',alignItems:'center'}}><Rain/><BotGlyph/><div style={{position:'absolute',bottom:170,fontFamily:'serif',fontWeight:800,fontSize:48,letterSpacing:4}}>機械化したため、雨に弱い。</div></AbsoluteFill>
    </Sequence>
    <Sequence from={345} durationInFrames={80}>
      <AbsoluteFill style={{backgroundColor:B,color:'#fff',justifyContent:'center',alignItems:'center',textAlign:'center'}}><div><div style={{fontFamily:'Arial,sans-serif',fontWeight:900,fontSize:104,letterSpacing:10}}>TERUTERU BOT</div><div style={{marginTop:36,fontFamily:'serif',fontSize:40,letterSpacing:7}}>テルテルボット</div><div style={{marginTop:22,fontSize:24,letterSpacing:3,color:'#bdbdb7'}}>受注生産　／　画像は一例です。</div></div></AbsoluteFill>
    </Sequence>
    <Sequence from={425} durationInFrames={25}>
      <AbsoluteFill style={{justifyContent:'center',alignItems:'center'}}><Text from={0} to={24} size={66}>驚異の力を発揮する。</Text></AbsoluteFill>
    </Sequence>
  </AbsoluteFill>
);
