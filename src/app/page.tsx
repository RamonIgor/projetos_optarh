"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

export default function ProductPortalPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // For now, redirect directly to processflow.
        // In the future, this page can show a selection of available products.
        router.replace('/processflow');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    // The AppLayout is added to avoid a flash of unstyled content while redirecting.
    <AppLayout unclassifiedCount={0} hasActivities={false}>
        <div className="flex items-center justify-center min-h-screen w-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    </AppLayout>
  );
}
