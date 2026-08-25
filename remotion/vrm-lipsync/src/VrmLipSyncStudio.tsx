import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {VrmLipSync, type VrmLipSyncProps} from './VrmLipSyncV3';

type VisualReference = {
  id?: string;
  kind?: string;
  title?: string | null;
  query?: string | null;
  prompt?: string | null;
  creator?: string | null;
  license?: string | null;
  startMs: number;
  endMs: number;
  renderFile?: string | null;
};
type ClipWithVisuals = {visualReferences?: VisualReference[]; backgroundFile?: string | null};
const sans = '"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const mono = '"IBM Plex Mono","Noto Sans Mono CJK JP",ui-monospace,monospace';

export const VrmLipSyncStudio: React.FC<VrmLipSyncProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const [visuals, setVisuals] = useState<VisualReference[]>([]);
  const [backgroundFile, setBackgroundFile] = useState<string | null>(null);
  const [handle] = useState(() => delayRender('visual timeline'));

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(props.clipFile))
      .then(async (r) => r.ok ? await r.json() as ClipWithVisuals : ({} as ClipWithVisuals))
      .then((clip) => {
        if (cancelled) return;
        const next = Array.isArray(clip.visualReferences) ? clip.visualReferences.filter((item) => {
          const s = Number(item?.startMs); const e = Number(item?.endMs);
          return Boolean(item?.renderFile) && Number.isFinite(s) && Number.isFinite(e) && e > s;
        }) : [];
        setVisuals(next);
        setBackgroundFile(typeof clip.backgroundFile === 'string' && clip.backgroundFile ? clip.backgroundFile : null);
        continueRender(handle);
      })
      .catch(() => { if (!cancelled) { setVisuals([]); setBackgroundFile(null); continueRender(handle); } });
    return () => { cancelled = true; };
  }, [handle, props.clipFile]);

  const nowMs = frame / fps * 1000;
  const current = useMemo(() => visuals.find((v) => Number(v.startMs) <= nowMs && Number(v.endMs) > nowMs) ?? null, [nowMs, visuals]);
  const currentIndex = current ? Math.max(0, visuals.indexOf(current)) : -1;
  const landscape = width > height;

  let opacity = 0;
  let local = 0;
  if (current) {
    const start = current.startMs / 1000 * fps;
    const end = current.endMs / 1000 * fps;
    const dur = Math.max(1, end - start);
    local = Math.max(0, frame - start);
    const fade = Math.min(10, Math.max(4, Math.floor(dur / 4)));
    opacity = interpolate(frame, [start, start + fade, end - fade, end], [0, 1, 1, 0], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  }
  const slide = (1 - opacity) * 30;
  const reveal = Math.min(1, local / 10);

  return (
    <AbsoluteFill style={{background: props.background, overflow:'hidden'}}>
      {backgroundFile ? <Img src={staticFile(backgroundFile)} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} /> : null}

      {landscape ? <>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 20% 45%, rgba(69,86,108,.20), transparent 34%), radial-gradient(circle at 83% 35%, rgba(187,143,74,.08), transparent 28%), #0b0e13'}} />
        <div style={{position:'absolute',inset:0,opacity:.12,backgroundImage:'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)',backgroundSize:'44px 44px'}} />
        <div style={{position:'absolute',left:'43%',top:108,bottom:126,width:1,background:'linear-gradient(transparent,rgba(210,170,98,.28) 18%,rgba(210,170,98,.28) 82%,transparent)'}} />
      </> : null}

      <VrmLipSync {...props} background={backgroundFile || landscape ? 'transparent' : props.background} />

      {current?.renderFile && landscape ? (
        <div style={{position:'absolute',zIndex:5,right:44,top:102,width:620,height:444,opacity,transform:`translateX(${slide}px) scale(${0.985 + reveal * .015})`,transformOrigin:'center right',fontFamily:sans}}>
          <div style={{position:'absolute',inset:0,border:'1px solid rgba(210,170,98,.32)',borderRadius:18,background:'linear-gradient(145deg,rgba(21,24,31,.96),rgba(11,13,18,.94))',boxShadow:'0 26px 70px rgba(0,0,0,.46), inset 0 1px rgba(255,255,255,.045)'}} />
          <div style={{position:'absolute',left:22,top:18,color:'#d2aa62',fontFamily:mono,fontSize:11,letterSpacing:'.20em'}}>OBSERVATION {String(currentIndex + 1).padStart(2,'0')}</div>
          <div style={{position:'absolute',left:22,right:22,top:42,color:'#f3f0e8',fontWeight:760,fontSize:25,lineHeight:1.25}}>{current.title || 'REFERENCE'}</div>
          <div style={{position:'absolute',left:22,right:22,top:84,bottom:42,borderRadius:12,overflow:'hidden',border:'1px solid rgba(255,255,255,.10)',background:'#11151b'}}>
            <Img src={staticFile(current.renderFile)} style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}} />
            <div style={{position:'absolute',top:0,bottom:0,width:2,left:`${Math.min(100, reveal * 100)}%`,background:'linear-gradient(transparent,rgba(210,170,98,.55),transparent)',opacity:1-reveal}} />
          </div>
          <div style={{position:'absolute',left:22,bottom:18,width:62,height:1,background:'#d2aa62'}} />
          {(current.creator || current.license) ? <div style={{position:'absolute',right:22,bottom:14,color:'rgba(255,255,255,.42)',fontFamily:mono,fontSize:9,letterSpacing:'.06em'}}>{[current.creator,current.license].filter(Boolean).join(' / ')}</div> : null}
          <div style={{position:'absolute',right:16,top:16,width:10,height:10,borderTop:'1px solid #d2aa62',borderRight:'1px solid #d2aa62'}} />
          <div style={{position:'absolute',left:16,bottom:16,width:10,height:10,borderBottom:'1px solid #d2aa62',borderLeft:'1px solid #d2aa62'}} />
        </div>
      ) : current?.renderFile ? (
        <div style={{position:'absolute',zIndex:5,right:'5%',top:'14%',width:'40%',overflow:'hidden',borderRadius:14,opacity}}><Img src={staticFile(current.renderFile)} style={{width:'100%',display:'block'}} /></div>
      ) : null}
    </AbsoluteFill>
  );
};

export type {VrmLipSyncProps};
