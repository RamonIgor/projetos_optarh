"use client";

import { useUser } from "@/firebase/auth/use-user";
import { useClient } from "@/firebase/auth/use-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";

export default function PulseCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: userLoading } = useUser();
  const { userProfile, isClientLoading, isConsultant } = useClient();
  const router = useRouter();
  const auth = useAuth();

  const isLoading = userLoading || isClientLoading;

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (!isConsultant) {
        const hasAccess = userProfile?.products?.includes("pulse_check");
        if (!hasAccess) {
          router.push("/");
        }
      }
    }
  }, [isLoading, user, userProfile, isConsultant, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  const canRender = user && (isConsultant || userProfile?.products?.includes("pulse_check"));

  if (!canRender) {
    return null; // Or a specific access denied component
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center border-b">
         <div className="flex items-center gap-4">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} unoptimized />
            <h1 className="text-xl font-bold text-amber-500 tracking-wider">PulseCheck</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        {children}
      </main>
    </div>
  );
}
