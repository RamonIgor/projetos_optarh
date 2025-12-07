"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useClient } from '@/firebase/auth/use-client';
import { Loader2, Box, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

const productInfo = {
  process_flow: {
    name: 'ProcessFlow',
    description: 'Estruture o fluxo de trabalho do seu time, da ideia à rotina.',
    href: '/processflow/brainstorm',
  },
  pesquisa_clima: {
    name: 'Pesquisa de Clima',
    description: 'Entenda e melhore o ambiente de trabalho da sua equipe.',
    href: '/pesquisa-clima', // Rota futura
  },
};

type ProductKey = keyof typeof productInfo;


export default function ProductPortalPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { userProfile, isClientLoading } = useClient();

  const isLoading = userLoading || isClientLoading;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile?.products || userProfile.products.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 p-4 text-center">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={180} height={60} unoptimized className="mb-8" />
            <h1 className="text-3xl font-bold text-foreground">Nenhum produto habilitado</h1>
            <p className="mt-2 text-lg text-muted-foreground">Sua conta não tem acesso a nenhum produto no momento.</p>
            <p className="mt-1 text-sm text-muted-foreground">Por favor, entre em contato com o administrador para solicitar acesso.</p>
        </div>
      )
  }
  
  // Se tiver apenas um produto, redireciona direto para ele
  if (userProfile.products.length === 1) {
      const singleProductKey = userProfile.products[0] as ProductKey;
      const product = productInfo[singleProductKey];
      if (product) {
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
            {userProfile.products.map(productKey => {
                const product = productInfo[productKey as ProductKey];
                if (!product) return null;
                
                return (
                    <Card key={productKey} className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-3 rounded-full">
                                    <Box className="h-6 w-6 text-primary"/>
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">{product.name}</CardTitle>
                                    <CardDescription>{product.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Button onClick={() => router.push(product.href)} className="w-full text-lg h-12 group">
                                Acessar
                                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    </div>
  );
}
