import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication - NestEgg',
  description: 'Sign in to your NestEgg household account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages don't need the main layout (sidebar, header)
  // They have their own full-page layout
  return <>{children}</>;
}