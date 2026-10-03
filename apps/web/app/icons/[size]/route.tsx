import { ImageResponse } from 'next/og';

const SIZES = new Set([180, 192, 512]);

/** PNG app icons for the manifest and iOS, drawn from the brand mark. `?maskable=1` adds safe-zone padding. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const maskable = new URL(req.url).searchParams.has('maskable');
  const mark = Math.round(size * (maskable ? 0.62 : 0.78));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D1C15', borderRadius: maskable ? 0 : size * 0.22 }}>
        <svg width={mark} height={mark} viewBox="4 6 26 22" fill="none">
          <path d="M5 17C9.5 10 24.5 10 29 17C24.5 24 9.5 24 5 17Z" stroke="#8FE0A0" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M17 22.5C14.2 20.6 14.2 13.4 17 11.5C19.8 13.4 19.8 20.6 17 22.5Z" fill="#8FE0A0" />
          <path d="M17 12.5V22" stroke="#0D1C15" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  );
}
