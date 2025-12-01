"use client";

import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutGrid, ListTodo, BarChart3, Shuffle, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AppLayoutProps {
  children: React.ReactNode;
  unclassifiedCount: number;
  hasActivities: boolean;
}

export default function AppLayout({ children, unclassifiedCount, hasActivities }: AppLayoutProps) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'Brainstorm', icon: ListTodo },
    { href: '/classificacao', label: 'Classificação', icon: LayoutGrid, count: unclassifiedCount, disabled: !hasActivities },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3, disabled: !hasActivities },
    { href: '/transicao', label: 'Transição', icon: Shuffle, disabled: !hasActivities },
    { href: '/operacional', label: 'Operacional', icon: PlayCircle, disabled: !hasActivities },
  ];

  return (
    <div className="min-h-screen w-full">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <nav className="p-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-black/5 flex items-center gap-1 shadow-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const link = (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  item.disabled ? "opacity-50 cursor-not-allowed" : ""
                )}
                aria-disabled={item.disabled}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <Badge variant={isActive ? "default" : "secondary"} className="rounded-full">{item.count}</Badge>
                )}
              </Link>
            );

            if (item.disabled) {
               const tooltipText = item.href === '/operacional' || item.href === '/classificacao' || item.href === '/dashboard' || item.href === '/transicao'
                ? "Adicione atividades no Brainstorm primeiro."
                : "Funcionalidade em desenvolvimento.";

              return (
                <TooltipProvider key={item.href} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {link}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }
            return link;
          })}
        </nav>
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-2">
        {children}
      </main>
    </div>
  )
}
