import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nireekshanam · Seed production monitoring',
    short_name: 'Nireekshanam',
    description: 'Geo-fenced field records for hybrid seed production, from sowing to final seed.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0d1c15',
    theme_color: '#0d1c15',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: "Today's field work", url: '/field', icons: [{ src: '/icons/192', sizes: '192x192' }] },
      { name: 'Review queue', url: '/review', icons: [{ src: '/icons/192', sizes: '192x192' }] },
    ],
  };
}
