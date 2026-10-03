import { NextResponse, type NextRequest } from 'next/server';

/** Redirects to /login when there is no session cookie. The signature is verified server-side in lib/session. */
export function proxy(req: NextRequest) {
  if (!req.cookies.get('nk_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api|_next|sw.js|offline|manifest.webmanifest|icons|favicon.ico|icon.svg).*)'],
};
