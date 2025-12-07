
"use client";

import { signOut } from 'firebase/auth';
import { useAuth, useUser, useClient } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutGrid, ListTodo, BarChart3, Shuffle, PlayCircle, Settings, Rows, Menu, UserPlus, KeyRound } from 'lucide-react';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu"
import { UserManagementDialog } from './UserManagementDialog';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from 'react';


interface AppLayoutProps {
  children: React.ReactNode;
  navContent?: React.ReactNode;
  unclassifiedCount: number;
  hasActivities: boolean;
}

export default function AppLayout({ children, navContent }: AppLayoutProps) {
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
  
  const authorizedConsultants = ['igorhenriqueramon@gmail.com', 'optarh@gmail.com'];
  const isAuthorized = isConsultant || (user && authorizedConsultants.includes(user.email || ''));

  const consultancyButton = (
    isAuthorized ? (
        <Button variant={pathname === '/consultoria' ? 'outline' : 'ghost'} onClick={() => { router.push('/consultoria'); if(mobileMenuOpen) setMobileMenuOpen(false); }}>
            <Rows className="mr-2 h-4 w-4" />
            Painel
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
                {isAuthorized && (
                     <UserManagementDialog>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>Gerenciar Colaboradores</span>
                        </DropdownMenuItem>
                    </UserManagementDialog>
                )}
                
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <KeyRound className="mr-2 h-4 w-4" />
                        <span>Segurança</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => { router.push('/change-password'); setMobileMenuOpen(false); }}>
                                Alterar minha senha
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
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
          {navContent}
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
              <SheetContent side="left" className="w-full max-w-xs">
                <div className="p-4">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} className="cursor-pointer mb-8" unoptimized/>
                  </Link>
                  
                  {/* Mobile navigation is passed here */}
                  <div onClick={() => setMobileMenuOpen(false)}>{navContent}</div>

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
