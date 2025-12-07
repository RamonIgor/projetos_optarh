"use client";

import { useUser } from "@/firebase/auth/use-user";
import { useClient } from "@/firebase/auth/use-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function ProcessFlowLayout({
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
      // If user is loaded and not a consultant, check for product access
      if (!isConsultant) {
        const hasAccess = userProfile?.products?.includes("process_flow");
        if (!hasAccess) {
          // Redirect to a dedicated "access-denied" page or the main portal
          // For now, redirecting to the portal root.
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

  // Render children only if user is loaded and has access (or is consultant)
  const canRender = user && (isConsultant || userProfile?.products?.includes("process_flow"));
  
  return canRender ? <>{children}</> : null;
}
