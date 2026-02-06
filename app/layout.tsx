import Link from 'next/link';
import { AuthStatus } from '@/components/auth/auth-status';
import { QueryProvider } from '@/components/providers/query-provider';
import { ServiceWorkerRegistration } from '@/components/providers/service-worker-registration';
import { Sidebar } from '@/components/sidebar/sidebar';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import type { Metadata } from 'next';

// Temporarily disabled Google Fonts for build environment
// Will load fonts at runtime via CSS
// import { Geist, Geist_Mono } from 'next/font/google';
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });
// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: 'Coding Sandbox',
  description: 'Browser-based coding agent system using Vercel Sandbox',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ja'>
      <body className='antialiased'>
        <QueryProvider>
          <ServiceWorkerRegistration />
          <div className='min-h-screen bg-background flex flex-col'>
            <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
              <div className='container flex h-14 items-center justify-between pr-4 pl-[calc(2.25rem+0.5rem+0.75rem)] mx-auto lg:px-4'>
                <Link href='/' className='mr-6 flex items-center space-x-2'>
                  <span className='font-bold'>Coding Sandbox</span>
                </Link>
                <div className='flex items-center gap-4'>
                  <nav className='flex items-center space-x-6 text-sm font-medium'>
                    <Link
                      href='/history'
                      className='transition-colors hover:text-foreground/80 text-foreground/60'
                    >
                      History
                    </Link>
                    <Link
                      href='/settings'
                      className='transition-colors hover:text-foreground/80 text-foreground/60'
                    >
                      Settings
                    </Link>
                  </nav>
                  <AuthStatus />
                </div>
              </div>
            </header>
            <div className='flex flex-1 min-h-0'>
              <Sidebar />
              <main className='flex-1 min-w-0 overflow-auto'>
                <div className='container px-0 py-4 mx-auto lg:px-4 lg:py-6'>{children}</div>
              </main>
            </div>
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
