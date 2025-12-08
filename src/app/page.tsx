
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useClient } from '@/firebase/auth/use-client';
import { Loader2, LogOut, ArrowRight, Workflow, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';

const allProducts = {
  process_flow: {
    name: 'ProcessFlow',
    description: 'Estruture o fluxo de trabalho do seu time, da ideia à rotina, com automação inteligente e gestão visual.',
    href: '/processflow',
    icon: <Workflow className="h-8 w-8 text-white" />,
    gradient: 'from-purple-500 to-indigo-500',
    glowClass: 'glow-icon-purple'
  },
  pulse_check: {
    name: 'PulseCheck',
    description: 'Monitore o clima e o engajamento da sua equipe em tempo real com pesquisas rápidas e insights acionáveis.',
    href: '/pulsecheck',
    icon: <BarChart2 className="h-8 w-8 text-white" />,
    gradient: 'from-orange-500 to-red-500',
    glowClass: 'glow-icon-orange'
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

  const handleCtaClick = (hasAccess: boolean, product: { href: string }) => {
    if (hasAccess) {
      if (product.href !== '#') {
        router.push(product.href);
      }
    } else {
      const whatsappUrl = `https://wa.me/5518981140305`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (isLoading || isLoggingOut || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-white to-gray-100">
      <div className="absolute top-0 left-0 right-0 h-96 w-full opacity-[0.15] [mask-image:linear-gradient(to_bottom,white,transparent)]">
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#8b5cf6' }} />
              <stop offset="100%" style={{ stopColor: '#6366f1' }} />
            </linearGradient>
          </defs>
          <path d="M0,150 C150,300 350,-50 500,150 C650,350 850,-50 1000,150 L1000,0 L0,0 Z" fill="url(#wave-gradient)" transform="scale(2,1)"/>
        </svg>
      </div>

      <div className="absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(closest-side,white,transparent)]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="pattern-connections" patternUnits="userSpaceOnUse" width="80" height="80" patternTransform="scale(1) rotate(0)">
                <path d="M10 10l60 60M70 10l-60 60" stroke="#9ca3af" strokeWidth="1"></path>
                <circle cx="10" cy="10" r="2" fill="#9ca3af"></circle>
                <circle cx="70" cy="70" r="2" fill="#9ca3af"></circle>
                <circle cx="10" cy="70" r="2" fill="#9ca3af"></circle>
                <circle cx="70" cy="10" r="2" fill="#9ca3af"></circle>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pattern-connections)"></rect>
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="container mx-auto px-6 py-6 flex justify-between items-center">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} unoptimized />
            <Button variant="link" className="text-slate-500" onClick={handleLogout}>
                Sair
                <LogOut className="ml-2 h-4 w-4" />
            </Button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-16"
            >
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight">Portal de Soluções</h1>
                <p className="mt-4 text-xl text-slate-500">Escolha a solução ideal para impulsionar sua equipe</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl">
              {Object.keys(allProducts).map((productKey, index) => {
                  const product = allProducts[productKey as ProductKey];
                  if (!product) return null;
                  
                  const hasAccess = isConsultant || userProfile?.products?.includes(productKey);

                  return (
                      <motion.div
                          key={productKey}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 * index }}
                          className="relative group"
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
                        <div className="relative bg-white rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.05)] h-full flex flex-col">
                          {productKey === 'pulse_check' && !hasAccess && (
                              <div className="absolute -top-4 -right-4 px-4 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-lg">
                                  CONTRATE
                              </div>
                          )}

                          <div className={cn("h-16 w-16 rounded-full flex items-center justify-center bg-gradient-to-br mb-6 shadow-lg", product.gradient, product.glowClass)}>
                            {product.icon}
                          </div>

                          <h2 className="text-3xl font-bold text-slate-800">{product.name}</h2>
                          <p className="mt-3 text-base text-slate-600 flex-grow">{product.description}</p>
                          
                          {hasAccess ? (
                             <Button onClick={() => handleCtaClick(true, product)} className={cn("mt-8 w-full h-14 text-lg rounded-xl bg-gradient-to-r text-white transition-shadow shadow-lg hover:shadow-xl", product.gradient)}>
                                Acessar
                                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Button>
                          ) : (
                            <div
                              onClick={() => handleCtaClick(false, product)}
                              className="relative mt-8 p-0.5 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl cursor-pointer group-hover:from-orange-500 group-hover:to-red-600 transition-all"
                            >
                              <div className="w-full h-full bg-white rounded-[10px] px-6 py-3.5 transition-all group-hover:bg-transparent">
                                <span className="font-bold text-lg text-center block bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent transition-all group-hover:text-white">
                                  Falar com Consultor
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                  );
              })}
            </div>
        </main>
      </div>
    </div>
  );
}
