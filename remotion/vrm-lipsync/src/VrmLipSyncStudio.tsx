import React, {useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Video} from '@remotion/media';
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
  shotType?: 'still' | 'video' | 'generated-video' | 'typography' | 'black' | string | null;
  mediaType?: 'image' | 'video' | 'procedural' | string | null;
  placement?: 'fullscreen' | 'panel' | string | null;
  fit?: 'cover' | 'contain' | string | null;
  text?: string | null;
  trimStartMs?: number | null;
  label?: string | null;
};

type StudioCaption = {startMs: number; endMs: number; text: string; speaker?: string};
type ClipWithVisuals = {
  visualReferences?: VisualReference[];
  backgroundFile?: string | null;
  captions?: StudioCaption[];
};

const sans = '"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const mono = '"IBM Plex Mono","Noto Sans Mono CJK JP",ui-monospace,monospace';

const isProcedural = (item: VisualReference) => item.shotType === 'typography' || item.shotType === 'black';
const isVideoShot = (item: VisualReference) => item.mediaType === 'video' || item.shotType === 'video' || item.shotType === 'generated-video';

export const VrmLipSyncStudio: React.FC<VrmLipSyncProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const [visuals, setVisuals] = useState<VisualReference[]>([]);
  const [captions, setCaptions] = useState<StudioCaption[]>([]);
  const [backgroundFile, setBackgroundFile] = useState<string | null>(null);
  const [handle] = useState(() => delayRender('visual timeline'));

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(props.clipFile))
      .then(async (r) => r.ok ? await r.json() as ClipWithVisuals : ({} as ClipWithVisuals))
      .then((clip) => {
        if (cancelled) return;
        const next = Array.isArray(clip.visualReferences) ? clip.visualReferences.filter((item) => {
          const s = Number(item?.startMs);
          const e = Number(item?.endMs);
          const hasRenderable = Boolean(item?.renderFile) || isProcedural(item);
          return hasRenderable && Number.isFinite(s) && Number.isFinite(e) && e > s;
        }) : [];
        setVisuals(next);
        setCaptions(Array.isArray(clip.captions) ? clip.captions : []);
        setBackgroundFile(typeof clip.backgroundFile === 'string' && clip.backgroundFile ? clip.backgroundFile : null);
        continueRender(handle);
      })
      .catch(() => {
        if (!cancelled) {
          setVisuals([]);
          setCaptions([]);
          setBackgroundFile(null);
          continueRender(handle);
        }
      });
    return () => { cancelled = true; };
  }, [handle, props.clipFile]);

  const nowMs = frame / fps * 1000;
  const current = useMemo(
    () => visuals.find((v) => Number(v.startMs) <= nowMs && Number(v.endMs) > nowMs) ?? null,
    [nowMs, visuals],
  );
  const currentCaption = useMemo(
    () => captions.find((caption) => Number(caption.startMs) <= nowMs && Number(caption.endMs) > nowMs) ?? null,
    [captions, nowMs],
  );
  const currentIndex = current ? Math.max(0, visuals.indexOf(current)) : -1;
  const landscape = width > height;

  let opacity = 0;
  let local = 0;
  let currentStartFrame = 0;
  let currentDurationFrames = 1;
  if (current) {
    const start = current.startMs / 1000 * fps;
    const end = current.endMs / 1000 * fps;
    const dur = Math.max(1, end - start);
    currentStartFrame = Math.max(0, Math.round(start));
    currentDurationFrames = Math.max(1, Math.ceil(dur));
    local = Math.max(0, frame - start);

    // film-plan shots are edits, so they cut cleanly. Legacy observation cards keep their old fade.
    if (current.shotType) {
      opacity = 1;
    } else {
      const fade = Math.min(10, Math.max(4, Math.floor(dur / 4)));
      opacity = interpolate(
        frame,
        [start, start + fade, end - fade, end],
        [0, 1, 1, 0],
        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
      );
    }
  }

  const slide = (1 - opacity) * 30;
  const reveal = Math.min(1, local / 10);
  const isFilmShot = Boolean(current?.shotType);
  const fullscreen = Boolean(current && isFilmShot && current.placement !== 'panel');
  const panel = Boolean(current && (!isFilmShot || current.placement === 'panel'));
  const objectFit = current?.fit === 'contain' ? 'contain' : 'cover';
  const trimBefore = Math.max(0, Math.round(Number(current?.trimStartMs || 0) / 1000 * fps));

  const renderMedia = (item: VisualReference, mode: 'fullscreen' | 'panel') => {
    if (item.shotType === 'black') {
      return <div style={{position: 'absolute', inset: 0, background: '#000'}} />;
    }
    if (item.shotType === 'typography') {
      return (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mode === 'fullscreen' ? '8%' : 28, background: '#090a0d'}}>
          <div style={{maxWidth: mode === 'fullscreen' ? '86%' : '100%', color: '#f7f5ef', fontFamily: sans, fontSize: mode === 'fullscreen' ? Math.round(Math.min(width, height) * 0.12) : 34, fontWeight: 850, lineHeight: 1.12, letterSpacing: '-0.03em', textAlign: 'center', whiteSpace: 'pre-wrap'}}>
            {item.text || item.title || ''}
          </div>
        </div>
      );
    }
    if (!item.renderFile) return null;
    if (isVideoShot(item)) {
      return (
        <Sequence from={currentStartFrame} durationInFrames={currentDurationFrames} layout="absolute-fill">
          <Video
            src={staticFile(item.renderFile)}
            trimBefore={trimBefore}
            volume={0}
            style={{width: '100%', height: '100%', objectFit, display: 'block'}}
          />
        </Sequence>
      );
    }
    return (
      <Img
        src={staticFile(item.renderFile)}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit, display: 'block'}}
      />
    );
  };

  return (
    <AbsoluteFill style={{background: props.background, overflow: 'hidden'}}>
      {backgroundFile ? (
        <Img src={staticFile(backgroundFile)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : null}

      {landscape ? <>
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 45%, rgba(69,86,108,.20), transparent 34%), radial-gradient(circle at 83% 35%, rgba(187,143,74,.08), transparent 28%), #0b0e13'}} />
        <div style={{position: 'absolute', inset: 0, opacity: .12, backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)', backgroundSize: '44px 44px'}} />
        <div style={{position: 'absolute', left: '43%', top: 108, bottom: 126, width: 1, background: 'linear-gradient(transparent,rgba(210,170,98,.28) 18%,rgba(210,170,98,.28) 82%,transparent)'}} />
      </> : null}

      <VrmLipSync {...props} background={backgroundFile || landscape ? 'transparent' : props.background} />

      {fullscreen && current ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 8, opacity, background: '#000', overflow: 'hidden'}}>
          {renderMedia(current, 'fullscreen')}
          {current.title && current.shotType !== 'typography' ? (
            <div style={{position: 'absolute', left: 32, top: 28, padding: '8px 12px', color: 'rgba(255,255,255,.72)', background: 'rgba(0,0,0,.42)', fontFamily: mono, fontSize: 11, letterSpacing: '.12em'}}>
              {current.title}
            </div>
          ) : null}
          {currentCaption?.text ? (
            <div style={{position: 'absolute', left: 48, right: 48, bottom: landscape ? 34 : 120, display: 'flex', justifyContent: 'center', zIndex: 10}}>
              <div style={{maxWidth: landscape ? 1040 : width - 56, padding: landscape ? '12px 24px 13px' : '16px 22px', border: '1px solid rgba(255,255,255,.16)', borderRadius: 14, background: 'rgba(8,9,12,.82)', color: '#f8f7f4', fontFamily: sans, fontWeight: 750, fontSize: landscape ? 38 : 46, lineHeight: 1.32, textAlign: 'center', textShadow: '0 2px 9px rgba(0,0,0,.72)', whiteSpace: 'pre-wrap'}}>
                {currentCaption.text}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {panel && current && landscape ? (
        <div style={{position: 'absolute', zIndex: 5, right: 44, top: 102, width: 620, height: 444, opacity, translate: `${slide}px 0`, scale: 0.985 + reveal * .015, transformOrigin: 'center right', fontFamily: sans}}>
          <div style={{position: 'absolute', inset: 0, border: '1px solid rgba(210,170,98,.32)', borderRadius: 18, background: 'linear-gradient(145deg,rgba(21,24,31,.96),rgba(11,13,18,.94))', boxShadow: '0 26px 70px rgba(0,0,0,.46), inset 0 1px rgba(255,255,255,.045)'}} />
          <div style={{position: 'absolute', left: 22, top: 18, color: '#d2aa62', fontFamily: mono, fontSize: 11, letterSpacing: '.20em'}}>OBSERVATION {String(currentIndex + 1).padStart(2, '0')}</div>
          <div style={{position: 'absolute', left: 22, right: 22, top: 42, color: '#f3f0e8', fontWeight: 760, fontSize: 25, lineHeight: 1.25}}>{current.title || 'REFERENCE'}</div>
          <div style={{position: 'absolute', left: 22, right: 22, top: 84, bottom: 42, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.10)', background: '#11151b'}}>
            {renderMedia(current, 'panel')}
            <div style={{position: 'absolute', top: 0, bottom: 0, width: 2, left: `${Math.min(100, reveal * 100)}%`, background: 'linear-gradient(transparent,rgba(210,170,98,.55),transparent)', opacity: 1 - reveal}} />
          </div>
          <div style={{position: 'absolute', left: 22, bottom: 18, width: 62, height: 1, background: '#d2aa62'}} />
          {(current.creator || current.license) ? (
            <div style={{position: 'absolute', right: 22, bottom: 14, color: 'rgba(255,255,255,.42)', fontFamily: mono, fontSize: 9, letterSpacing: '.06em'}}>
              {[current.creator, current.license].filter(Boolean).join(' / ')}
            </div>
          ) : null}
          <div style={{position: 'absolute', right: 16, top: 16, width: 10, height: 10, borderTop: '1px solid #d2aa62', borderRight: '1px solid #d2aa62'}} />
          <div style={{position: 'absolute', left: 16, bottom: 16, width: 10, height: 10, borderBottom: '1px solid #d2aa62', borderLeft: '1px solid #d2aa62'}} />
        </div>
      ) : panel && current ? (
        <div style={{position: 'absolute', zIndex: 5, right: '5%', top: '14%', width: '40%', height: '42%', overflow: 'hidden', borderRadius: 14, opacity}}>
          {renderMedia(current, 'panel')}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export type {VrmLipSyncProps};
