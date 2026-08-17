import React from 'react';
import {Composition} from 'remotion';
import {VrmTalker} from './VrmTalker';

export const Root: React.FC = () => (
  <Composition
    id="VrmTalker"
    component={VrmTalker}
    durationInFrames={1800}
    fps={30}
    width={720}
    height={1280}
  />
);
