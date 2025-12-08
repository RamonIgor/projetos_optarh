"use client";

import { useUser } from "@/firebase/auth/use-user";
import { useClient } from "@/firebase/auth/use-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout"; 

export default function PulseCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: userLoading } = useUser();
  const { userProfile, isClientLoading, isConsultant } = useClient();
  const router = useRouter();

  const isLoading = userLoading || isClientLoading;

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
    return null;
  }
  
  return (
    <AppLayout>
      <div className="w-full theme-pulsecheck">
         {children}
      </div>
    </AppLayout>
  );
}
