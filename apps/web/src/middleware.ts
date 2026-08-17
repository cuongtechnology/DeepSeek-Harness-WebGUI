import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must match SESSION_COOKIE_NAME in @deepseek-harness/shared. Hardcoded here so
// the Edge middleware does not pull Node-only code from the shared barrel.
const SESSION_COOKIE = 'dhwg_session';

/**
 * Auth gating: unauthenticated users are sent to /login; authenticated users
 * visiting /login are sent to /dashboard. The API still enforces real auth via
 * JWT on every endpoint — this middleware only shapes the UX.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/login')) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match page routes only: exclude /api, /_next, and any path with a file
  // extension (static assets, favicon, etc.).
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
