'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Activity,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/deals', label: 'Deals', icon: Handshake },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/transactions', label: 'Transactions', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = session?.user?.name
    ?.split(' ')
    ?.map((w: string) => w?.[0])
    ?.join('')
    ?.toUpperCase() ?? 'U';

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-primary text-primary-foreground p-2 rounded-lg"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-primary text-primary-foreground z-50 flex flex-col transition-all duration-normal',
          collapsed ? 'w-[68px]' : 'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center h-16 px-4 border-b border-white/10', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && <span className="font-display text-lg font-bold tracking-tight">CRM Hub</span>}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors hidden md:block"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className={cn('px-3 py-4 border-t border-white/10', collapsed ? 'flex flex-col items-center gap-2' : '')}>
          <div className={cn('flex items-center gap-3', collapsed ? 'flex-col' : '')}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-white/20 text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user?.name ?? 'User'}</p>
                <p className="text-xs text-white/50 truncate">{(session?.user as any)?.role ?? ''}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size={collapsed ? 'icon-sm' : 'sm'}
            className="mt-2 w-full text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => signOut({ redirectTo: '/login' })}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
