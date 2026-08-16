import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';

const IVORY='#f4f3ee';
const BLACK='#050506';
const GREY='#777872';
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};

const fade=(frame:number,a:number,b:number,c:number,d:number)=>interpolate(frame,[a,b,c,d],[0,1,1,0],clamp);

const FilmGrain:React.FC=()=>{
  const frame=useCurrentFrame();
  const x=(frame*37)%120;
  const y=(frame*53)%120;
  return <AbsoluteFill style={{pointerEvents:'none',opacity:.07,mixBlendMode:'multiply',backgroundImage:'radial-gradient(circle at 20% 20%, #000 0 1px, transparent 1.4px), radial-gradient(circle at 70% 65%, #000 0 1px, transparent 1.4px)',backgroundSize:'13px 13px, 17px 17px',backgroundPosition:`${x}px ${y}px, ${-x}px ${-y}px`}}/>;
};

const Rain:React.FC<{strength?:number}>=({strength=1})=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{overflow:'hidden',pointerEvents:'none'}}>{Array.from({length:95}).map((_,i)=>{
    const x=(i*137)%1180-50;
    const speed=24+(i%11)*2.7;
    const y=((i*211+frame*speed)%2350)-240;
    const h=95+(i%7)*23;
    return <div key={i} style={{position:'absolute',left:x,top:y,width:2+(i%3===0?1:0),height:h,background:`rgba(230,235,240,${0.12*strength+(i%4)*.035})`,rotate:'11deg',boxShadow:'0 0 8px rgba(255,255,255,.09)'}}/>;
  })}</AbsoluteFill>;
};

const Lightning:React.FC<{at:number}>=({at})=>{
  const frame=useCurrentFrame();
  const local=Math.abs(frame-at);
  const opacity=local<2?0.88:local<5?0.23:0;
  return <AbsoluteFill style={{backgroundColor:'#eef5ff',opacity,pointerEvents:'none'}}/>;
};

const Bot:React.FC<{scale?:number;rotate?:number;wet?:boolean;cropped?:boolean}>=({scale=1,rotate=0,wet=false,cropped=false})=>{
  const frame=useCurrentFrame();
  const breathe=interpolate(Math.sin(frame/18),[-1,1],[.992,1.008]);
  const sway=interpolate(Math.sin(frame/32),[-1,1],[-1.2,1.2]);
  const glow=wet?0.8:0.35;
  const spikes=Array.from({length:18},(_,i)=>{
    const a=(-158+i*18)*Math.PI/180;
    const r=250+(i%3)*16;
    const x=540+Math.cos(a)*r;
    const y=650+Math.sin(a)*r*.75;
    const x2=540+Math.cos(a)*(r+105+(i%4)*22);
    const y2=650+Math.sin(a)*(r+105+(i%4)*22)*.75;
    return <line key={'s'+i} x1={x} y1={y} x2={x2} y2={y2} stroke="#e8e9e6" strokeWidth={18-(i%3)*2} strokeLinecap="round"/>;
  });
  const cables=Array.from({length:14},(_,i)=>{
    const sx=330+(i%7)*70;
    const sy=860+Math.floor(i/7)*135;
    const ex=170+(i*71)%760;
    const ey=1110+(i%5)*85;
    return <path key={'c'+i} d={`M ${sx} ${sy} C ${sx-80} ${sy+70}, ${ex+90} ${ey-50}, ${ex} ${ey}`} fill="none" stroke={i%3===0?'#c9cac6':'#f1f1ef'} strokeWidth={12} strokeLinecap="round" opacity={.9}/>;
  });
  return <div style={{width:1080,height:1500,scale:scale*breathe,rotate:`${rotate+sway}deg`,translate:cropped?'0px 190px':'0px 30px',filter:`drop-shadow(0 34px 80px rgba(0,0,0,.48)) drop-shadow(0 0 ${wet?34:18}px rgba(255,255,255,${glow}))`}}>
    <svg viewBox="0 0 1080 1500" width="1080" height="1500">
      <defs>
        <linearGradient id="shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="28%" stopColor="#dadbd7"/>
          <stop offset="55%" stopColor="#ffffff"/>
          <stop offset="78%" stopColor="#c8c9c5"/>
          <stop offset="100%" stopColor="#f7f7f4"/>
        </linearGradient>
        <radialGradient id="eye" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="24%" stopColor="#cfd6da"/>
          <stop offset="47%" stopColor="#777f84"/>
          <stop offset="71%" stopColor="#1c1f22"/>
          <stop offset="100%" stopColor="#020203"/>
        </radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
      </defs>
      {spikes}
      <ellipse cx="540" cy="1330" rx="360" ry="56" fill="#000" opacity=".28" filter="url(#soft)"/>
      <path d="M265 555 C270 405 370 300 540 295 C715 300 815 408 815 560 C815 700 727 820 540 830 C350 820 265 700 265 555Z" fill="url(#shell)" stroke="#b9bab7" strokeWidth="8"/>
      <path d="M350 535 C390 390 690 355 750 535 C690 600 390 610 350 535Z" fill="#e9e9e6" stroke="#b7b8b4" strokeWidth="7"/>
      <ellipse cx="540" cy="525" rx="104" ry="92" fill="url(#eye)"/>
      <circle cx="515" cy="494" r="19" fill="#fff" opacity=".9"/>
      <circle cx="540" cy="525" r="26" fill="#020203"/>
      <path d="M303 580 C350 625 410 648 540 648 C670 648 730 625 777 580" fill="none" stroke="#b7b8b4" strokeWidth="8"/>
      <g opacity=".98">
        <path d="M302 710 C245 760 220 865 235 995 C255 1165 350 1280 540 1310 C730 1280 825 1165 845 995 C860 865 835 760 778 710 C690 785 390 785 302 710Z" fill="url(#shell)" stroke="#b7b8b4" strokeWidth="9"/>
        {Array.from({length:12},(_,i)=>{
          const col=i%3,row=Math.floor(i/3);
          const x=315+col*150+(row%2)*28;
          const y=820+row*112;
          return <g key={'p'+i}><rect x={x} y={y} width={122} height={80} rx={24} fill={i%2===0?'#fdfdfb':'#dfe0dc'} stroke="#b2b3af" strokeWidth="6"/><circle cx={x+24} cy={y+20} r="6" fill="#8c8d89"/><circle cx={x+98} cy={y+60} r="6" fill="#8c8d89"/></g>;
        })}
      </g>
      {cables}
      <g>
        {Array.from({length:9},(_,i)=>{
          const x=210+i*84;
          const y=1160+(i%2)*54;
          return <path key={'leg'+i} d={`M ${x} ${y} C ${x-40} ${y+70}, ${x+35} 1330, ${x+(i%2?45:-25)} 1420`} fill="none" stroke="url(#shell)" strokeWidth="34" strokeLinecap="round"/>;
        })}
      </g>
      <path d="M300 410 C340 312 435 250 540 250 C646 250 741 313 780 410" fill="none" stroke="#f9f9f6" strokeWidth="42" strokeLinecap="round"/>
      {Array.from({length:24},(_,i)=>{
        const angle=i/24*Math.PI*2;
        const x=540+Math.cos(angle)*285;
        const y=720+Math.sin(angle)*380;
        return <circle key={'r'+i} cx={x} cy={y} r={7+(i%3)*2} fill="#8f908c" opacity=".75"/>;
      })}
      {wet && Array.from({length:18},(_,i)=>{
        const x=315+(i*83)%470;
        const y=420+(i*119)%690;
        return <ellipse key={'w'+i} cx={x} cy={y} rx={7+(i%4)*3} ry={20+(i%5)*7} fill="#fff" opacity={.45+(i%3)*.12} rotate={i%2?8:-7}/>;
      })}
    </svg>
  </div>;
};

const Caption:React.FC<{children:React.ReactNode;from?:number;to?:number;size?:number;dark?:boolean;bottom?:number;tracking?:number}>=({children,from=0,to=90,size=54,dark=false,bottom=180,tracking=5})=>{
  const frame=useCurrentFrame();
  return <div style={{position:'absolute',left:80,right:80,bottom,opacity:fade(frame,from,from+10,to-12,to),translate:interpolate(frame,[from,from+18],['0px 28px','0px 0px'],{...clamp,easing:Easing.bezier(.16,1,.3,1)}),color:dark?IVORY:BLACK,fontFamily:'"Hiragino Mincho ProN","Yu Mincho",serif',fontWeight:800,fontSize:size,letterSpacing:tracking,textAlign:'center',lineHeight:1.45,textShadow:dark?'0 2px 18px #000':'none'}}>{children}</div>;
};

const DarkStage:React.FC<{children:React.ReactNode}>=({children})=><AbsoluteFill style={{background:'radial-gradient(circle at 50% 42%, #262a2d 0%, #0b0c0e 34%, #020203 76%)',overflow:'hidden'}}>{children}<FilmGrain/></AbsoluteFill>;

const WhiteStage:React.FC<{children:React.ReactNode}>=({children})=><AbsoluteFill style={{background:'radial-gradient(circle at 50% 40%, #fff 0%, #ecece6 56%, #d7d7d0 100%)',overflow:'hidden'}}>{children}<FilmGrain/></AbsoluteFill>;

const Intro:React.FC=()=>{
  const frame=useCurrentFrame();
  return <DarkStage>
    <Rain strength={1.35}/><Lightning at={18}/><Lightning at={73}/>
    <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.5))'}}/>
    <div style={{position:'absolute',left:0,right:0,top:655,display:'flex',justifyContent:'center',opacity:interpolate(frame,[28,44,104,118],[0,1,1,0],clamp),filter:'blur(.2px)'}}><Bot scale={1.03} wet cropped/></div>
    <Caption dark from={8} to={132} size={62} bottom={250}>雨は、まだ降るのか。</Caption>
  </DarkStage>;
};

const DetailShot:React.FC<{kind:number}>=({kind})=>{
  const frame=useCurrentFrame();
  const zoom=interpolate(frame,[0,95],[1.55,1.82],{...clamp,easing:Easing.bezier(.25,.1,.25,1),output:'perceptual-scale'});
  const tx=[-175,115,-30][kind%3];
  const ty=[540,250,40][kind%3];
  return <DarkStage><div style={{position:'absolute',left:0,right:0,top:0,bottom:0,display:'flex',justifyContent:'center',alignItems:'center',translate:`${tx}px ${ty}px`,scale:zoom}}><Bot wet rotate={kind===1?-8:kind===2?7:2}/></div><div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(0,0,0,.65),transparent 32%,transparent 70%,rgba(0,0,0,.55))'}}/></DarkStage>;
};

const Hero:React.FC=()=>{
  const frame=useCurrentFrame();
  const s=interpolate(frame,[0,170],[.86,1.02],{...clamp,easing:Easing.bezier(.16,1,.3,1),output:'perceptual-scale'});
  return <WhiteStage>
    <div style={{position:'absolute',left:0,right:0,top:210,display:'flex',justifyContent:'center',scale:s}}><Bot/></div>
    <Caption from={18} to={165} size={58} bottom={245}>てるてる坊主は、次の段階へ。</Caption>
  </WhiteStage>;
};

const RainWeakness:React.FC=()=>{
  const frame=useCurrentFrame();
  const flicker=frame>120&&frame<126?0.12:1;
  return <DarkStage>
    <Rain strength={1.55}/><Lightning at={19}/><Lightning at={84}/><Lightning at={152}/>
    <div style={{position:'absolute',left:0,right:0,top:330,display:'flex',justifyContent:'center',opacity:flicker}}><Bot scale={.94} wet rotate={-3}/></div>
    <Caption dark from={80} to={180} size={58} bottom={205}>機械化したため、雨に弱い。</Caption>
  </DarkStage>;
};

const EndCard:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor:BLACK,color:IVORY,justifyContent:'center',alignItems:'center',textAlign:'center'}}>
    <div style={{opacity:interpolate(frame,[0,18,118,135],[0,1,1,0],clamp)}}>
      <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:104,fontWeight:900,letterSpacing:12}}>TERUTERU BOT</div>
      <div style={{marginTop:34,fontFamily:'"Hiragino Mincho ProN","Yu Mincho",serif',fontSize:48,fontWeight:700,letterSpacing:9}}>テルテルボット</div>
      <div style={{marginTop:70,fontFamily:'serif',fontSize:30,letterSpacing:6,color:'#b9bab5'}}>受注生産</div>
      <div style={{marginTop:14,fontSize:22,letterSpacing:3,color:'#777872'}}>画像は一例です。個体差があります。</div>
    </div>
  </AbsoluteFill>;
};

const LastLine:React.FC=()=>{
  const frame=useCurrentFrame();
  return <WhiteStage><div style={{position:'absolute',left:70,right:70,top:850,textAlign:'center',opacity:interpolate(frame,[0,10,74,88],[0,1,1,0],clamp),fontFamily:'"Hiragino Mincho ProN","Yu Mincho",serif',fontSize:68,fontWeight:800,letterSpacing:8,color:BLACK}}>驚異の力を発揮する。</div></WhiteStage>;
};

export const TeruteruBotCM:React.FC=()=> (
  <AbsoluteFill style={{backgroundColor:BLACK}}>
    <Sequence from={0} durationInFrames={150}><Intro/></Sequence>
    <Sequence from={150} durationInFrames={95}><DetailShot kind={0}/></Sequence>
    <Sequence from={245} durationInFrames={95}><DetailShot kind={1}/></Sequence>
    <Sequence from={340} durationInFrames={170}><Hero/></Sequence>
    <Sequence from={510} durationInFrames={190}><RainWeakness/></Sequence>
    <Sequence from={700} durationInFrames={140}><EndCard/></Sequence>
    <Sequence from={840} durationInFrames={60}><LastLine/></Sequence>
  </AbsoluteFill>
);
