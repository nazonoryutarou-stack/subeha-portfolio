import React, {useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {VrmLipSync, type VrmLipSyncProps} from './VrmLipSyncV2';

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

type ClipWithVisuals = {
  visualReferences?: VisualReference[];
};

export const VrmLipSyncStudio: React.FC<VrmLipSyncProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const [visuals, setVisuals] = useState<VisualReference[]>([]);
  const [visualsHandle] = useState(() => delayRender('画像タイムラインを読み込み中'));

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(props.clipFile))
      .then(async (response) => {
        if (!response.ok) return {} as ClipWithVisuals;
        return await response.json() as ClipWithVisuals;
      })
      .then((clip) => {
        if (cancelled) return;
        const next = Array.isArray(clip.visualReferences)
          ? clip.visualReferences.filter((item) => {
              const startMs = Number(item?.startMs);
              const endMs = Number(item?.endMs);
              return Boolean(item?.renderFile) && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
            })
          : [];
        setVisuals(next);
        continueRender(visualsHandle);
      })
      .catch(() => {
        if (cancelled) return;
        setVisuals([]);
        continueRender(visualsHandle);
      });
    return () => {
      cancelled = true;
    };
  }, [props.clipFile, visualsHandle]);

  const nowMs = frame / fps * 1000;
  const current = useMemo(
    () => visuals.find((item) => Number(item.startMs) <= nowMs && Number(item.endMs) > nowMs) ?? null,
    [nowMs, visuals],
  );

  const boxWidth = width * 0.38;
  const boxHeight = Math.min(height * 0.32, boxWidth * 1.1);
  const right = width * 0.055;
  const top = height * 0.13;

  let opacity = 0;
  if (current) {
    const startFrame = current.startMs / 1000 * fps;
    const endFrame = current.endMs / 1000 * fps;
    const durationFrames = Math.max(1, endFrame - startFrame);
    const fadeFrames = Math.min(6, Math.max(1, Math.floor(durationFrames / 3)));
    opacity = interpolate(
      frame,
      [startFrame, startFrame + fadeFrames, endFrame - fadeFrames, endFrame],
      [0, 1, 1, 0],
      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
    );
  }

  return (
    <AbsoluteFill>
      <VrmLipSync {...props} />
      {current?.renderFile ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 5,
            right,
            top,
            width: boxWidth,
            height: boxHeight,
            borderRadius: Math.max(8, width * 0.012),
            overflow: 'hidden',
            background: '#111',
            boxShadow: `0 ${Math.max(8, height * 0.012)}px ${Math.max(20, width * 0.04)}px rgba(0,0,0,.45)`,
            opacity,
          }}
        >
          <Img
            src={staticFile(current.renderFile)}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
          {(current.creator || current.license) ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: `${Math.max(4, height * 0.004)}px ${Math.max(6, width * 0.008)}px`,
                background: 'linear-gradient(transparent, rgba(0,0,0,.72))',
                color: 'rgba(255,255,255,.76)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: Math.max(9, Math.round(Math.min(width, height) * 0.012)),
                textAlign: 'right',
              }}
            >
              {[current.creator, current.license].filter(Boolean).join(' / ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export type {VrmLipSyncProps};
