"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This page now simply redirects to the new default page for processflow.
export default function ProcessFlowRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/processflow/brainstorm');
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
