import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { AuthStatus } from '@/components/auth/auth-status';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import type { Metadata } from 'next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Coding Agent Sandbox',
  description: 'Browser-based coding agent system using Vercel Sandbox',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ja'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <div className='min-h-screen bg-background'>
            <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
              <div className='container flex h-14 items-center justify-between px-4 mx-auto'>
                <Link href='/' className='mr-6 flex items-center space-x-2'>
                  <span className='font-bold'>Coding Agent Sandbox</span>
                </Link>
                <div className='flex items-center gap-4'>
                  <nav className='flex items-center space-x-6 text-sm font-medium'>
                    <Link
                      href='/sandbox'
                      className='transition-colors hover:text-foreground/80 text-foreground/60'
                    >
                      Sandbox
                    </Link>
                    <Link
                      href='/history'
                      className='transition-colors hover:text-foreground/80 text-foreground/60'
                    >
                      History
                    </Link>
                  </nav>
                  <AuthStatus />
                </div>
              </div>
            </header>
            <main className='container px-4 py-6 mx-auto'>{children}</main>
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
