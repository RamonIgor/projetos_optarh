
"use client";

import { useUser } from "@/firebase/auth/use-user";
import { useClient } from "@/firebase/auth/use-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function ConsultancyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: userLoading } = useUser();
  const { isConsultant, isClientLoading } = useClient();
  const router = useRouter();

  const isLoading = userLoading || isClientLoading;

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (!isConsultant) {
        router.push("/");
      }
    }
  }, [isLoading, user, isConsultant, router]);
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return user && isConsultant ? <>{children}</> : null;
}
