import React from 'react';
import {Composition, staticFile} from 'remotion';
import {VrmLipSyncStudio as VrmLipSync, type VrmLipSyncProps} from './VrmLipSyncStudio';

const defaultProps: VrmLipSyncProps = {
  title: '',
  telop: '',
  modelFile: 'Subeha.vrm',
  audioFile: 'voice.wav',
  envelopeFile: 'envelope.json',
  clipFile: 'clip.json',
  background: '#111318',
  showMeter: false,
};

const calculateMetadata = async ({props}: {props: VrmLipSyncProps}) => {
  const response = await fetch(staticFile(props.envelopeFile));
  if (!response.ok) {
    throw new Error(`public/${props.envelopeFile} がありません。先に npm run prepare を実行してください。`);
  }
  const data = await response.json() as {durationInFrames?: number; values?: number[]};
  const durationInFrames = data.durationInFrames ?? data.values?.length ?? 0;
  if (!Number.isFinite(durationInFrames) || durationInFrames < 1) {
    throw new Error(`${props.envelopeFile} に有効な durationInFrames がありません。`);
  }
  return {durationInFrames: Math.ceil(durationInFrames)};
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="VrmLipSync"
      component={VrmLipSync}
      durationInFrames={30}
      calculateMetadata={calculateMetadata}
      defaultProps={defaultProps}
      fps={30}
      width={720}
      height={1280}
    />
    <Composition
      id="VrmLipSyncSquare"
      component={VrmLipSync}
      durationInFrames={30}
      calculateMetadata={calculateMetadata}
      defaultProps={defaultProps}
      fps={30}
      width={900}
      height={900}
    />
    <Composition
      id="VrmLipSyncLandscape"
      component={VrmLipSync}
      durationInFrames={30}
      calculateMetadata={calculateMetadata}
      defaultProps={defaultProps}
      fps={30}
      width={1280}
      height={720}
    />
  </>
);
