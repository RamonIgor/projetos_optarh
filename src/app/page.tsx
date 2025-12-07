
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useClient } from '@/firebase/auth/use-client';
import { Loader2, Box, ArrowRight, Sparkles, LogOut, Wrench } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

const allProducts = {
  process_flow: {
    name: 'ProcessFlow',
    description: 'Estruture o fluxo de trabalho do seu time, da ideia à rotina.',
    href: '/processflow/brainstorm',
    icon: <Box className="h-6 w-6 text-primary"/>,
    color: 'primary',
  },
  pesquisa_clima: {
    name: 'Pesquisa de Clima',
    description: 'Entenda e melhore o ambiente de trabalho da sua equipe.',
    href: '#',
    icon: <Sparkles className="h-6 w-6 text-amber-500" />,
    color: 'amber',
  },
};

type ProductKey = keyof typeof allProducts;

export default function ProductPortalPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, loading: userLoading } = useUser();
  const { userProfile, isClientLoading, isConsultant } = useClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoading = userLoading || isClientLoading;
  
  const handleLogout = async () => {
    if (!auth) return;
    setIsLoggingOut(true);
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!isLoading && userProfile?.products?.length === 1 && !isConsultant) {
        const singleProductKey = userProfile.products[0] as ProductKey;
        const product = allProducts[singleProductKey];
        if (product && product.href !== '#') {
            router.replace(product.href);
        }
    }
  }, [isLoading, userProfile, isConsultant, router]);


  if (isLoading || isLoggingOut) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const handleCtaClick = (hasAccess: boolean, product: { href: string }) => {
    if (hasAccess) {
        if (product.href !== '#') {
            router.push(product.href);
        }
    } else {
        const whatsappUrl = `https://wa.me/5518981140305`;
        window.open(whatsappUrl, '_blank');
    }
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} unoptimized />
        <div className="flex items-center gap-2">
            {isConsultant && (
                <Button variant="outline" onClick={() => router.push('/consultoria')}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Painel
                </Button>
            )}
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground">Portal de Soluções</h1>
            <p className="mt-2 text-lg text-muted-foreground">Selecione o produto que deseja acessar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
            {Object.keys(allProducts).map(productKey => {
                const product = allProducts[productKey as ProductKey];
                if (!product) return null;
                
                const hasAccess = isConsultant || userProfile?.products?.includes(productKey);

                return (
                    <div key={productKey} className="relative group">
                        <Card 
                            className={cn(
                              "transition-all duration-300 h-full flex flex-col border-2", 
                              hasAccess ? "border-transparent bg-card" : "border-dashed bg-card/50",
                              hasAccess && "hover:shadow-xl hover:-translate-y-1"
                            )}
                        >
                            {!hasAccess && (
                                <Badge className="absolute -top-3 right-4 text-sm px-3 py-1 bg-amber-500 text-white shadow-lg border-2 border-amber-300">
                                    CONTRATE
                                </Badge>
                            )}
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-3 rounded-full", 
                                        hasAccess ? (product.color === 'primary' ? 'bg-primary/10' : 'bg-amber-100') : 'bg-muted'
                                    )}>
                                        {product.icon}
                                    </div>
                                    <CardTitle className="text-2xl">{product.name}</CardTitle>
                                </div>
                                 <CardDescription className="pt-2">{product.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                 <Button 
                                    onClick={() => handleCtaClick(!!hasAccess, product)} 
                                    className="w-full text-lg h-12"
                                    variant={hasAccess ? 'default' : 'default'}
                                 >
                                    {hasAccess ? (
                                      <>
                                        Acessar
                                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                      </>
                                    ) : (
                                      "Falar com Consultor"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );
            })}
        </div>
      </main>
    </div>
  );
}
