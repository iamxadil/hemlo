import React from 'react';
import { Composition } from 'remotion';
import { DemoShop, DURATION } from './DemoShop';
import { HemloAd, AD_DURATION } from './ad/HemloAd';
import { HemloFilm, filmFrames, hasFilm } from './ad2/HemloFilm';

export const Root: React.FC = () => (
  <>
    <Composition id="DemoShopAr" component={DemoShop} durationInFrames={DURATION} fps={60} width={1920} height={1080} defaultProps={{ lang: 'ar' as const }} />
    <Composition id="DemoShopEn" component={DemoShop} durationInFrames={DURATION} fps={60} width={1920} height={1080} defaultProps={{ lang: 'en' as const }} />
    {/* the ad: vertical, for Reels, TikTok and Stories */}
    <Composition id="HemloAdAr" component={HemloAd} durationInFrames={AD_DURATION} fps={60} width={1080} height={1920} defaultProps={{ lang: 'ar' as const }} />
    <Composition id="HemloAdEn" component={HemloAd} durationInFrames={AD_DURATION} fps={60} width={1080} height={1920} defaultProps={{ lang: 'en' as const }} />
    {/* the film: 16:9, English, narrated */}
    <Composition id="HemloFilmEn" component={HemloFilm} durationInFrames={filmFrames('en')} fps={60} width={1920} height={1080} defaultProps={{ lang: 'en' as const }} />
    {hasFilm('ar') && <Composition id="HemloFilmAr" component={HemloFilm} durationInFrames={filmFrames('ar')} fps={60} width={1920} height={1080} defaultProps={{ lang: 'ar' as const }} />}
  </>
);
