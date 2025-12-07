"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Rota de conveniência para redirecionar para a criação de uma nova pesquisa.
export default function CreateSurveyPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/pulsecheck/editor/novo');
  }, [router]);

  return null; // A página não renderiza nada, apenas redireciona.
}
