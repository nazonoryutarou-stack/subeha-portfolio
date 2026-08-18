import React from 'react';
import {Composition} from 'remotion';
import {VrmLipSync} from './VrmLipSync';

export const Root: React.FC = () => (
  <Composition
    id="VrmLipSync"
    component={VrmLipSync}
    durationInFrames={900}
    fps={30}
    width={720}
    height={1280}
  />
);
