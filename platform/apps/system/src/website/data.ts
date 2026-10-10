// The Website add-on's data: what /v1/web returns, typed (a site, its pages, its theme and settings).
import { useQuery } from '@tanstack/react-query';
import { api, remembered } from '../lib/api';
import { useApp } from '../lib/app';

export type Two = { ar?: string; en?: string };
export interface WebTheme { preset?: string; accent?: string; radius?: string; font?: string; dark?: boolean }
export interface WebContact { phone?: string; whatsapp?: string; email?: string; address?: string; mapUrl?: string }
export interface WebSocial { instagram?: string; facebook?: string; tiktok?: string; youtube?: string; x?: string }
export interface WebCta { whatsapp?: boolean; phone?: boolean; inquiry?: boolean }
export interface WebSettings { contact?: WebContact; social?: WebSocial; nav?: { label: Two; href: string }[]; footer?: Two; cta?: WebCta }
export interface WebSection { id?: string; type: string; title?: Two; [k: string]: unknown }
export interface WebSeo { title?: Two; description?: Two; image?: string | null; noindex?: boolean }
export type WebStatus = 'not_enabled' | 'setup' | 'draft' | 'published';

export interface Site {
  id: string; organizationId: string; vertical: string; status: WebStatus; lang: string;
  name: Two; tagline: Two; about: Two; theme: WebTheme; settings: WebSettings;
  logoId: string | null; faviconId: string | null; subdomain: string | null; domain: string | null; domainStatus: string;
  publishedAt: string | null; createdAt: string; updatedAt: string;
}
export interface WebPage {
  id: string; slug: string; kind: string; title: Two; sections: WebSection[]; seo: WebSeo; sort: number; createdAt: string; updatedAt: string;
}
export interface Dashboard {
  vertical: string; site: Site | null; pages: WebPage[]; face: { slug: string; name: string } | null;
  hasUnpublishedChanges: boolean;
  suggestedSubdomain: string; url: string | null; themes: string[]; pageKinds: string[]; sectionTypes: string[];
  entitlement: ({ active: boolean; paidUntil: string | null } & Record<string, unknown>) | null;
  request: { id: string; action: string; status: string } | null;
  offer: { code: string; name: Two; description: Two; compatible: boolean; priceMonth: number | null; priceYear: number | null; configured: boolean } | null;
}

export function useSite() {
  const { sys } = useApp();
  return useQuery<Dashboard>({ queryKey: ['web-site'], queryFn: () => remembered(`web.${sys.business.id}`, () => api('/v1/web/site')), staleTime: 60_000 });
}
