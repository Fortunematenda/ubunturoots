'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type LogoutAction = () => Promise<void>;

type ProfileMenuProps = {
  initials: string;
  fullName?: string | null;
  logoutAction: LogoutAction;
};

function useProfileMenuCloseBehavior() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (containerRef.current && targetNode && !containerRef.current.contains(targetNode)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  return {
    containerRef,
    open,
    setOpen
  };
}

export function DesktopProfileMenu({ initials, fullName, logoutAction }: ProfileMenuProps) {
  const { containerRef, open, setOpen } = useProfileMenuCloseBehavior();

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-ubuntu-gold font-extrabold text-ubuntu-green"
        aria-label="Open profile menu"
        aria-expanded={open}
        title={fullName || 'Profile'}
        onClick={() => setOpen((prev) => !prev)}
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <Link
            href="/profile"
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-ubuntu-gray"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action={logoutAction}>
            <button
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-ubuntu-gray"
              type="submit"
            >
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function MobileProfileMenu({ initials, fullName, logoutAction }: ProfileMenuProps) {
  const { containerRef, open, setOpen } = useProfileMenuCloseBehavior();

  return (
    <div ref={containerRef} className="relative w-full" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3"
        aria-expanded={open}
        aria-label="Open profile menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ubuntu-gold font-extrabold text-ubuntu-green">
            {initials}
          </div>
          <div>
            <p className="text-xs font-semibold text-ubuntu-green">{fullName || 'My Profile'}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-600">Account</p>
          </div>
        </div>
        <span className="text-slate-600" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
          <Link
            href="/profile"
            className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-ubuntu-gray"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action={logoutAction}>
            <button
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-ubuntu-gray"
              type="submit"
            >
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
