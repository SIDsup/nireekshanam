import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ServiceWorkerRegistrar } from '@/components/pwa/sw-registrar';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Nireekshanam', template: '%s · Nireekshanam' },
  description: 'Hybrid seed production monitoring: geo-fenced field records from sowing to final seed.',
  applicationName: 'Nireekshanam',
  appleWebApp: { capable: true, title: 'Nireekshanam', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icons/180' },
};

export const viewport: Viewport = {
  themeColor: '#0d1c15',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
