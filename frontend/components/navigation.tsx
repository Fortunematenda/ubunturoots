import Link from 'next/link';
import { cookies } from 'next/headers';
import { AUTH_COOKIE } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DesktopProfileMenu, MobileProfileMenu } from '@/components/profile-menu';

const baseLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/family-tree', label: 'Family Tree' },
  { href: '/relationship-finder', label: 'Relationship Finder' },
  { href: '/directory', label: 'Members' },
  { href: '/memories', label: 'Memories' },
  { href: '/funeral-cases', label: 'Funerals' }
];

const publicLinks = [
  { href: '/login', label: 'Login' },
  { href: '/signup', label: 'Sign up' }
];

type BackendMeResponse = {
  success?: boolean;
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role?: string;
  };
};

function resolveBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL || 'http://localhost:4000';
}

function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  const first = parts[0]?.[0] || 'U';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  return (first + second).toUpperCase();
}

export async function Navigation() {
  async function logoutAction() {
    'use server';
    cookies().set({
      name: AUTH_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0
    });
    redirect('/');
  }

  const token = cookies().get(AUTH_COOKIE)?.value;
  const isLoggedIn = Boolean(token);
  const links = isLoggedIn ? baseLinks : publicLinks;

  let me: BackendMeResponse['user'] | null = null;
  if (token) {
    try {
      const res = await fetch(`${resolveBackendBaseUrl()}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: 'no-store'
      });

      if (res.ok) {
        const payload = (await res.json()) as BackendMeResponse;
        me = payload.user || null;
      }
    } catch {
      me = null;
    }
  }

  const initials = me?.fullName ? getInitials(me.fullName) : 'UR';

  return (
    <header className="sticky top-0 z-20 border-b border-ubuntu-gray bg-white/90 backdrop-blur">
      <div className="flex w-full items-center justify-between px-4 py-3 md:px-10">
        <Link href="/" className="block">
          <p className="text-lg font-bold text-ubuntu-green">Ubuntu Roots</p>
          <p className="text-xs text-slate-500">Our Family. Our Strength.</p>
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-ubuntu-gray"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {isLoggedIn ? (
            <DesktopProfileMenu initials={initials} fullName={me?.fullName} logoutAction={logoutAction} />
          ) : null}
        </div>
      </div>
      <div className="px-3 pb-3 md:hidden">
        {isLoggedIn ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-ubuntu-gray px-3 py-2">
            <MobileProfileMenu initials={initials} fullName={me?.fullName} logoutAction={logoutAction} />
          </div>
        ) : null}
        <nav className="flex gap-1 overflow-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
