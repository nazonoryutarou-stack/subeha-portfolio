import React from 'react';
import {Composition} from 'remotion';
import {VrmVisemeTest} from './VrmVisemeTest';

export const VisemeRoot:React.FC = () => (
  <Composition
    id="VrmVisemeTest"
    component={VrmVisemeTest}
    durationInFrames={180}
    fps={30}
    width={720}
    height={1280}
  />
);
