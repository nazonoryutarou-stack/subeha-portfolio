import React from 'react';
import {Composition} from 'remotion';
import {TeruteruBotCG2} from './TeruteruBotCG2';

export const Root: React.FC = () => (
  <Composition
    id="TeruteruBotCG"
    component={TeruteruBotCG2}
    durationInFrames={450}
    fps={30}
    width={720}
    height={1280}
  />
);
