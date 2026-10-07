import React from 'react';
import { Composition } from 'remotion';
import { DemoShop, DURATION } from './DemoShop';

export const Root: React.FC = () => (
  <>
    <Composition id="DemoShopAr" component={DemoShop} durationInFrames={DURATION} fps={60} width={1920} height={1080} defaultProps={{ lang: 'ar' as const }} />
    <Composition id="DemoShopEn" component={DemoShop} durationInFrames={DURATION} fps={60} width={1920} height={1080} defaultProps={{ lang: 'en' as const }} />
  </>
);
