import React from 'react';
import {Composition} from 'remotion';
import {VrmLipSync} from './VrmLipSync';
import {VrmLipSyncBackup} from './backup/VrmLipSyncBackup';
import {backupMeta} from './backup/generatedTimeline';

const FPS=30;

export const Root: React.FC = () => (
  <>
    <Composition
      id="VrmLipSync"
      component={VrmLipSync}
      durationInFrames={900}
      fps={FPS}
      width={720}
      height={1280}
    />
    <Composition
      id="VrmLipSyncBackup"
      component={VrmLipSyncBackup}
      durationInFrames={Math.max(1,Math.ceil(backupMeta.durationMs/1000*FPS))}
      fps={FPS}
      width={720}
      height={1280}
    />
  </>
);
