import { Config } from '@remotion/cli/config';
// Edge is on this machine; Remotion drives it headless to draw every frame.
Config.setBrowserExecutable('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
Config.setVideoImageFormat('png');
Config.setConcurrency(8);
