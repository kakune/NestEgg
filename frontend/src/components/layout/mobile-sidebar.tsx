'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  CreditCard,
  TrendingUp,
  Users,
  Wallet,
  Calculator,
  FileText,
  Settings,
} from 'lucide-react';

const navigation = [
  {
    name: 'Overview',
    items: [{ name: 'Dashboard', href: '/', icon: Home }],
  },
  {
    name: 'Management',
    items: [
      { name: 'Transactions', href: '/transactions', icon: CreditCard },
      { name: 'Categories', href: '/categories', icon: TrendingUp },
      { name: 'Actors', href: '/actors', icon: Users },
      { name: 'Income', href: '/incomes', icon: Wallet },
      { name: 'Settlements', href: '/settlements', icon: Calculator },
    ],
  },
  {
    name: 'Administration',
    items: [
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Import/Export', href: '/csv', icon: FileText },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface MobileSidebarProps {
  onClose: () => void;
}

export function MobileSidebar({ onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 py-4">
      {/* Logo area */}
      <div className="flex h-16 shrink-0 items-center">
        <Link href="/" className="flex items-center gap-2" onClick={handleLinkClick}>
          <Calculator className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">NestEgg</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {navigation.map((group) => (
            <li key={group.name}>
              <div className="text-xs font-semibold leading-6 text-muted-foreground">
                {group.name}
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        className={cn(
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 shrink-0',
                            isActive
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground'
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}