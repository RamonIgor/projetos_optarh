"use client";

import { useUser } from "@/firebase/auth/use-user";
import { useClient } from "@/firebase/auth/use-client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Loader2, ListTodo, LayoutGrid, BarChart3, Shuffle, PlayCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { onSnapshot, query, collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { type Activity } from "@/types/activity";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"


const ProcessFlowNav = () => {
  const db = useFirestore();
  const { clientId } = useClient();
  const pathname = usePathname();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!db || !clientId) {
      setActivities([]);
      return;
    }
    const q = query(collection(db, 'clients', clientId, 'activities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => doc.data() as Activity);
      setActivities(activitiesData);
    });
    return () => unsubscribe();
  }, [db, clientId]);

  const hasActivities = activities.length > 0;
  const unclassifiedCount = useMemo(() => activities.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso').length, [activities]);

  const navItems = [
    { href: '/processflow/brainstorm', label: 'Brainstorm', icon: ListTodo },
    { href: '/processflow/classificacao', label: 'Classificação', icon: LayoutGrid, count: unclassifiedCount, disabled: !hasActivities && unclassifiedCount === 0 },
    { href: '/processflow/transicao', label: 'Transição', icon: Shuffle, disabled: !hasActivities },
    { href: '/processflow/operacional', label: 'Operacional', icon: PlayCircle, disabled: !hasActivities },
    { href: '/processflow/dashboard', label: 'Dashboard', icon: BarChart3, disabled: !hasActivities },
  ];

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = pathname === item.href;
    const link = (
      <Link
        key={item.href}
        href={item.disabled ? '#' : item.href}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          item.disabled ? "opacity-50 cursor-not-allowed" : "",
          "sm:flex"
        )}
        aria-disabled={item.disabled}
        onClick={(e) => {
          if (item.disabled) e.preventDefault();
        }}
      >
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <Badge variant={isActive ? "default" : "secondary"} className="rounded-full">{item.count}</Badge>
        )}
      </Link>
    );

    if (item.disabled) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent><p>Adicione e aprove atividades para habilitar.</p></TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };
  
  return (
    <nav className="hidden sm:flex p-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-black/5 items-center gap-1 shadow-sm">
      {navItems.map(renderNavItem)}
    </nav>
  );
};


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
      if (!isConsultant) {
        const hasAccess = userProfile?.products?.includes("process_flow");
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

  const canRender = user && (isConsultant || userProfile?.products?.includes("process_flow"));
  
  return canRender ? (
     <TooltipProvider>
        <AppLayout>
            {children}
        </AppLayout>
     </TooltipProvider>
  ) : null;
}
