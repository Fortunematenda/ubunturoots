import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';

export const metadata: Metadata = {
  title: 'Ubuntu Roots',
  description: 'Our Family. Our Strength.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="w-full px-4 pb-12 pt-6 md:px-8">{children}</main>
      </body>
    </html>
  );
}
