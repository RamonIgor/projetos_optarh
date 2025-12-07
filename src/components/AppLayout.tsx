
"use client";

import { signOut } from 'firebase/auth';
import { useAuth, useUser, useClient } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutGrid, ListTodo, BarChart3, Shuffle, PlayCircle, Settings, Rows, Menu, UserPlus, KeyRound, Workflow, AreaChart, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserManagementDialog } from './UserManagementDialog';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useMemo, useEffect } from 'react';
import { onSnapshot, query, collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { type Activity } from "@/types/activity";


const ProcessFlowNav = () => {
  const db = useFirestore();
  const { clientId } = useClient();
  const pathname = usePathname();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!db || !clientId) {
      setActivities([]);
      return;
    }
    const q = query(collection(db, 'clients', clientId, 'activities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => doc.data() as Activity);
      setActivities(activitiesData);
    });
    return () => unsubscribe();
  }, [db, clientId]);

  const hasActivities = activities.length > 0;
  const unclassifiedCount = useMemo(() => activities.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso').length, [activities]);

  const navItems = [
    { href: '/processflow/brainstorm', label: 'Brainstorm', icon: ListTodo },
    { href: '/processflow/classificacao', label: 'Classificação', icon: LayoutGrid, count: unclassifiedCount, disabled: !hasActivities },
    { href: '/processflow/transicao', label: 'Transição', icon: Shuffle, disabled: !hasActivities },
    { href: '/processflow/operacional', label: 'Operacional', icon: PlayCircle, disabled: !hasActivities },
    { href: '/processflow/dashboard', label: 'Dashboard', icon: BarChart3, disabled: !hasActivities },
  ];
  
  if (!pathname.startsWith('/processflow')) {
    return null;
  }

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = pathname === item.href;
    const link = (
      <Link
        key={item.href}
        href={item.disabled ? '#' : item.href}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          item.disabled ? "opacity-50 cursor-not-allowed" : "",
        )}
        aria-disabled={item.disabled}
        onClick={(e) => {
          if (item.disabled) e.preventDefault();
        }}
      >
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <Badge variant={isActive ? "default" : "secondary"} className="rounded-full">{item.count}</Badge>
        )}
      </Link>
    );

    if (item.disabled) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent><p>Adicione e aprove atividades para habilitar.</p></TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };
  
  return (
    <nav className="flex flex-wrap p-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-black/5 items-center gap-1 shadow-sm">
      {navItems.map(renderNavItem)}
    </nav>
  );
};


const PulseCheckNav = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/pulsecheck', label: 'Minhas Pesquisas', icon: AreaChart },
    { href: '/pulsecheck/editor/novo', label: 'Nova Pesquisa', icon: PlusCircle, isEditor: true },
  ];
  
  if (!pathname.startsWith('/pulsecheck')) {
    return null;
  }
  
  const isEditorActive = pathname.startsWith('/pulsecheck/editor');

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = isEditorActive ? item.isEditor : pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    );
  };
  
  return (
    <nav className="flex flex-wrap p-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-black/5 items-center gap-1 shadow-sm">
      {navItems.map(renderNavItem)}
    </nav>
  );
};


interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const auth = useAuth();
  const { user } = useUser();
  const { isConsultant } = useClient();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };
  
  const isProcessFlow = pathname.startsWith('/processflow');
  const isPulseCheck = pathname.startsWith('/pulsecheck');

  const productName = useMemo(() => {
    if (isProcessFlow) return 'ProcessFlow';
    if (isPulseCheck) return 'PulseCheck';
    return null;
  }, [isProcessFlow, isPulseCheck]);

  const consultancyButton = (
    isConsultant ? (
        <Button variant={pathname === '/consultoria' ? 'outline' : 'ghost'} onClick={() => { router.push('/consultoria'); if(mobileMenuOpen) setMobileMenuOpen(false); }} className="w-full justify-start">
            <Rows className="mr-2 h-4 w-4" />
            Painel de Consultoria
        </Button>
    ) : null
  );
  
  const SettingsMenu = ({ isMobile = false }: { isMobile?: boolean }) => {
    const commonItemClass = "w-full justify-start";
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {isMobile ? (
                    <Button variant="ghost" className={commonItemClass}><Settings className="mr-2 h-4 w-4" /> Configurações</Button>
                ) : (
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Configurações</span>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isMobile ? "start" : "end"}>
                {isConsultant && (
                     <UserManagementDialog>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>Gerenciar Colaboradores</span>
                        </DropdownMenuItem>
                    </UserManagementDialog>
                )}
                 <DropdownMenuItem onClick={() => { router.push('/change-password'); setMobileMenuOpen(false); }}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Alterar senha
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
       <TooltipProvider delayDuration={100}>
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} className="cursor-pointer" unoptimized/>
          </Link>
          {productName && (
              <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                  <span className="text-lg">/</span>
                  <span className="font-bold text-foreground">{productName}</span>
              </div>
          )}
        </div>

        <div className="flex-1 flex justify-center">
            <div className="hidden sm:flex">
                <ProcessFlowNav />
                <PulseCheckNav />
            </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
            {consultancyButton}
            <SettingsMenu />
            <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
            </Button>
        </div>
        <div className="sm:hidden">
           <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full max-w-xs p-0">
                <div className="p-4">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} className="cursor-pointer mb-8" unoptimized/>
                  </Link>
                  
                  <div className="flex flex-col gap-2" onClick={() => setMobileMenuOpen(false)}>
                       <ProcessFlowNav />
                       <PulseCheckNav />
                  </div>

                  <div className="mt-8 pt-4 border-t">
                    {consultancyButton}
                    <div className="mt-2" onClick={() => setMobileMenuOpen(false)}>
                       <SettingsMenu isMobile />
                    </div>
                    <div className="mt-2">
                      <Button variant="ghost" onClick={handleLogout} className="w-full justify-start">
                          <LogOut className="mr-2 h-4 w-4" />
                          Sair
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
        </div>
      </header>
       </TooltipProvider>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-2 flex-grow flex">
        {children}
      </main>
    </div>
  )
}
