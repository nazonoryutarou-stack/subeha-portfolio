import React from 'react';
import {Composition} from 'remotion';
import {TeruteruBotCG} from './TeruteruBotCG';

export const Root: React.FC = () => (
  <Composition
    id="TeruteruBotCG"
    component={TeruteruBotCG}
    durationInFrames={450}
    fps={30}
    width={720}
    height={1280}
  />
);
