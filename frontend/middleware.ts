import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'ubuntu_roots_auth';
const PUBLIC_ROUTES = ['/', '/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => (route === '/' ? pathname === '/' : pathname.startsWith(route)));
  const hasAuthCookie = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (!hasAuthCookie && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasAuthCookie && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (hasAuthCookie && isPublicRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)']
};
