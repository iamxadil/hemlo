import { describe, it, expect } from 'vitest';
import { websitePathRoute, businessRootRedirect } from '../apps/api/src/website-routing';

describe('customer Website host routing', () => {
  it('maps site root and nested pages to the public renderer', () => {
    expect(websitePathRoute('business.hemlohq.com', '/s/north-star/')).toEqual({
      siteSlug: 'north-star', apiPath: '/v1/web/pub', siteBase: '/s/north-star',
    });
    expect(websitePathRoute('business.hemlohq.com', '/s/north-star/properties/villa-1')).toEqual({
      siteSlug: 'north-star', apiPath: '/v1/web/pub/properties/villa-1', siteBase: '/s/north-star',
    });
  });

  it('rejects malformed site paths and leaves unrelated hosts alone', () => {
    expect(websitePathRoute('business.hemlohq.com', '/s/')).toEqual({ invalid: true });
    expect(websitePathRoute('business.hemlohq.com', '/s/%2fadmin')).toEqual({ invalid: true });
    expect(websitePathRoute('system.hemlohq.com', '/s/north-star')).toBeNull();
    expect(websitePathRoute('business.hemlohq.com', '/about')).toBeNull();
  });

  it('sends the bare business host to the live sample, in the visitor’s language', () => {
    expect(businessRootRedirect('business.hemlohq.com', '/', '')).toBe('https://business.hemlohq.com/s/sample');
    expect(businessRootRedirect('business.hemlohq.com', '/', '?lang=en')).toBe('https://business.hemlohq.com/s/sample?lang=en');
    expect(businessRootRedirect('business.hemlohq.com', '/s/sample', '')).toBeNull();
    expect(businessRootRedirect('api.hemlohq.com', '/', '')).toBeNull();
  });
});
