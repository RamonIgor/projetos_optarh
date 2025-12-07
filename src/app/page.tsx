
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useClient } from '@/firebase/auth/use-client';
import { Loader2, Box, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const allProducts = {
  process_flow: {
    name: 'ProcessFlow',
    description: 'Estruture o fluxo de trabalho do seu time, da ideia à rotina.',
    href: '/processflow/brainstorm',
    icon: <Box className="h-6 w-6 text-primary"/>,
  },
  pesquisa_clima: {
    name: 'Pesquisa de Clima',
    description: 'Entenda e melhore o ambiente de trabalho da sua equipe.',
    href: '#', // Rota futura
    icon: <Sparkles className="h-6 w-6 text-amber-500" />,
  },
};

type ProductKey = keyof typeof allProducts;


export default function ProductPortalPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { userProfile, isClientLoading, isConsultant } = useClient();

  const isLoading = userLoading || isClientLoading;
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Para consultores, se tiver apenas um produto, redireciona direto
   useEffect(() => {
    if (isConsultant && userProfile?.products.length === 1) {
      const singleProductKey = userProfile.products[0] as ProductKey;
      const product = allProducts[singleProductKey];
      if (product && product.href !== '#') {
          router.replace(product.href);
      }
    }
  }, [isConsultant, userProfile, router]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  // Se for um usuário cliente e tiver apenas um produto, redireciona direto
  if (!isConsultant && userProfile?.products?.length === 1) {
      const singleProductKey = userProfile.products[0] as ProductKey;
      const product = allProducts[singleProductKey];
      if (product && product.href !== '#') {
          router.replace(product.href);
          return ( // Retorna um loader enquanto redireciona
             <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          );
      }
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 p-4">
        <div className="text-center mb-12">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={220} height={70} unoptimized className="mx-auto" />
            <h1 className="text-4xl font-bold text-foreground mt-4">Portal de Soluções</h1>
            <p className="mt-2 text-lg text-muted-foreground">Selecione o produto que deseja acessar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
            {Object.keys(allProducts).map(productKey => {
                const product = allProducts[productKey as ProductKey];
                if (!product) return null;
                
                const hasAccess = isConsultant || userProfile?.products?.includes(productKey);

                return (
                    <Card 
                        key={productKey} 
                        className={cn(
                          "transition-all duration-300", 
                          hasAccess && "hover:shadow-xl hover:-translate-y-1",
                          !hasAccess && "bg-background/50 opacity-70"
                        )}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-full", hasAccess ? "bg-primary/10" : "bg-muted")}>
                                    {product.icon}
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">{product.name}</CardTitle>
                                    <CardDescription>{product.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Button 
                                onClick={() => hasAccess && product.href !== '#' && router.push(product.href)} 
                                className="w-full text-lg h-12 group"
                                disabled={!hasAccess || product.href === '#'}
                             >
                                {hasAccess ? (
                                  <>
                                    Acessar
                                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                  </>
                                ) : (
                                  "Contrate"
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    </div>
  );
}
