'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Header } from './header';
import { Sidebar } from './sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const PUBLIC_PATHS = ['/auth/signin', '/auth/signup'];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, isInitialized } = useAuth();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    // Only process redirects when auth state is stable (not loading and initialized)
    if (!isLoading && isInitialized) {
      // If not authenticated and trying to access protected path
      if (!isAuthenticated && !isPublicPath) {
        // Handle legacy /login path - redirect to /auth/signin without redirect parameter
        if (pathname === '/login') {
          router.replace('/auth/signin');
          return;
        }
        
        // Only redirect if we're not already on signin page to prevent loops
        if (pathname !== '/auth/signin') {
          const redirectUrl = `/auth/signin${pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''}`;
          router.push(redirectUrl);
        }
      } else if (isAuthenticated && isPublicPath) {
        // Only redirect authenticated users away from auth pages if not already redirecting
        if (pathname === '/auth/signin' || pathname === '/auth/signup') {
          router.replace('/');
        }
      }
    }
  }, [isAuthenticated, isLoading, isInitialized, pathname, isPublicPath, router]);

  // Show loading state while checking authentication or during initialization
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Render auth pages without the main layout
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Don't render the main layout if not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Render the main layout for authenticated users
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1">
          <div className="container mx-auto px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}