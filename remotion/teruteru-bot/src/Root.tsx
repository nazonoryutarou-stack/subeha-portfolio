import React from 'react';
import {Composition} from 'remotion';
import {TeruteruBotCM} from './TeruteruBotCM';

export const Root: React.FC = () => (
  <Composition
    id="TeruteruBotCM"
    component={TeruteruBotCM}
    durationInFrames={450}
    fps={30}
    width={1080}
    height={1920}
  />
);
