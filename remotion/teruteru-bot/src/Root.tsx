import React from 'react';
import {Composition} from 'remotion';
import {TeruteruBotScenario} from './TeruteruBotScenario';

export const Root: React.FC = () => (
  <Composition
    id="TeruteruBotCG"
    component={TeruteruBotScenario}
    durationInFrames={450}
    fps={30}
    width={720}
    height={1280}
  />
);
