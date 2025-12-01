"use client";

import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutGrid, ListTodo, BarChart3, Shuffle, PlayCircle, Settings, Rows } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RegisterUserDialog } from './RegisterUserDialog';
import Image from 'next/image';

interface AppLayoutProps {
  children: React.ReactNode;
  unclassifiedCount: number;
  hasActivities: boolean;
}

export default function AppLayout({ children, unclassifiedCount, hasActivities }: AppLayoutProps) {
  const auth = useAuth();
  const { user } = useUser();
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

  const authorizedConsultants = ['igorhenriqueramon@gmail.com', 'optarh@gmail.com'];
  const isConsultancyPanelDisabled = !user?.email || !authorizedConsultants.includes(user.email);

  const consultancyButton = (
     <Button variant="ghost" onClick={() => router.push('/consultoria')} disabled={isConsultancyPanelDisabled}>
        <Rows className="mr-2 h-4 w-4" />
        Painel
    </Button>
  );

  return (
    <div className="min-h-screen w-full flex flex-col">
       <TooltipProvider delayDuration={100}>
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} className="cursor-pointer" unoptimized/>
          </Link>
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
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        {link}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                )
              }
              return link;
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
            {isConsultancyPanelDisabled ? (
                 <Tooltip>
                    <TooltipTrigger asChild>
                      {consultancyButton}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Acesso restrito à consultoria.</p>
                    </TooltipContent>
                  </Tooltip>
            ) : consultancyButton}
           
            <RegisterUserDialog>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Configurações</span>
                </Button>
            </RegisterUserDialog>
            <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
            </Button>
        </div>
      </header>
       </TooltipProvider>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-2 flex-grow">
        {children}
      </main>
    </div>
  )
}
