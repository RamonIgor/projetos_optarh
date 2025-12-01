"use client";

import { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, User, Repeat, CheckSquare, XSquare, Clock, ChevronsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { isActivityPending, isActivityOverdue, getNextExecution, type Recurrence } from '@/lib/date-utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const ACTIVITIES_COLLECTION = 'rh-dp-activities';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const StatCard = ({ title, value, icon, className }: { title: string, value: string | number, icon: React.ReactNode, className?: string }) => (
    <Card className={cn("shadow-sm", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const recurrenceOrder: Recurrence[] = ['Diária', 'Semanal', 'Mensal', 'Trimestral', 'Anual', 'Sob demanda'];

const categoryStyles: Record<Activity['categoria'] & {}, string> = {
    DP: 'bg-purple-100 text-purple-800 border-purple-200',
    RH: 'bg-green-100 text-green-800 border-green-200',
    Compartilhado: 'bg-blue-100 text-blue-800 border-blue-200',
};

function ActivityItem({ activity, onToggle }: { activity: Activity, onToggle: (id: string, isPending: boolean) => void }) {
    const isPending = isActivityPending(activity);
    const isOverdue = isPending && isActivityOverdue(activity);
    const nextExecution = getNextExecution(activity);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = () => {
        setIsUpdating(true);
        onToggle(activity.id, isPending);
        // Optimistic update, but we re-enable it after a short delay
        // The parent component's state update will re-render this anyway
        setTimeout(() => setIsUpdating(false), 1000);
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
                "flex items-start gap-4 rounded-lg p-4 transition-colors",
                !isPending ? 'bg-green-500/10' : isOverdue ? 'bg-red-500/10' : 'bg-card'
            )}
        >
            <Checkbox 
                id={`activity-${activity.id}`}
                checked={!isPending}
                onCheckedChange={handleToggle}
                className="h-6 w-6 mt-1"
                disabled={isUpdating}
            />
            <div className="flex-1">
                <label htmlFor={`activity-${activity.id}`} className="font-semibold text-lg cursor-pointer">{activity.nome}</label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                    <Badge variant="outline" className={cn(activity.categoria ? categoryStyles[activity.categoria] : '')}>
                        {activity.categoria}
                    </Badge>
                    <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {activity.responsavel}</div>
                    <div className="flex items-center gap-1.5"><Repeat className="h-3 w-3" /> {activity.recorrencia}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                   {activity.ultimaExecucao && (
                     <p>
                        Última execução: {formatDistanceToNow((activity.ultimaExecucao as Timestamp).toDate(), { addSuffix: true, locale: ptBR })}
                     </p>
                   )}
                   {nextExecution && (
                     <p className={cn(isOverdue && 'text-red-500 font-medium')}>
                        {isOverdue ? 'Execução atrasada!' : `Próxima execução esperada: ${formatDistanceToNow(nextExecution, { addSuffix: true, locale: ptBR })}`}
                     </p>
                   )}
                </div>
            </div>
             {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
        </motion.div>
    );
}


function RecurrenceGroup({ title, activities, onToggle }: { title: Recurrence, activities: Activity[], onToggle: (id: string, isPending: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(true);
    const completed = activities.filter(a => !isActivityPending(a)).length;
    const total = activities.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    if (activities.length === 0) return null;

    return (
        <Card className="overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold">{title}</h2>
                            <Badge variant="secondary">{activities.length} atividades</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">{completed} de {total} concluídas</span>
                            <Progress value={progress} className="w-32 h-2" />
                            <Button variant="ghost" size="sm" className="w-9 p-0">
                                <ChevronsDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
                            </Button>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <CardContent className="p-4 space-y-3">
                         <AnimatePresence>
                            {activities.map(activity => (
                                <ActivityItem key={activity.id} activity={activity} onToggle={onToggle} />
                            ))}
                        </AnimatePresence>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    )
}

export default function OperationalPage() {
    const db = useFirestore();
    const { user, loading: userLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, startUpdateTransition] = useTransition();

    const [categoryFilter, setCategoryFilter] = useState<Activity['categoria'] | 'Todas'>('Todas');
    const [recurrenceFilter, setRecurrenceFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('pending'); // 'all', 'pending'

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (!db) {
            setIsLoading(false);
            return;
        }

        const q = query(collection(db, ACTIVITIES_COLLECTION), where('status', '==', 'aprovada'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setAllActivities(activitiesData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user, userLoading, router]);

    const handleToggleActivity = (activityId: string, isCurrentlyPending: boolean) => {
        if (!db) return;
        startUpdateTransition(async () => {
            try {
                const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
                await updateDoc(docRef, {
                    ultimaExecucao: isCurrentlyPending ? serverTimestamp() : null
                });
                toast({
                    title: `Atividade ${isCurrentlyPending ? 'concluída' : 'reaberta'}!`,
                    description: 'O status da atividade foi atualizado.',
                });
            } catch (error) {
                console.error(error);
                toast({
                    title: 'Erro ao atualizar atividade',
                    variant: 'destructive'
                });
            }
        });
    };
    
    const unclassifiedCount = 0; 
    const allResponsibles = useMemo(() => Array.from(new Set(allActivities.map(a => a.responsavel).filter(Boolean))), [allActivities]);
    const allRecurrences = useMemo(() => Array.from(new Set(allActivities.map(a => a.recorrencia).filter(Boolean))), [allActivities]);


    const filteredActivities = useMemo(() => {
        return allActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'Todas' || activity.categoria === categoryFilter;
            const recurrenceMatch = recurrenceFilter === 'all' || activity.recorrencia === recurrenceFilter;
            const responsibleMatch = responsibleFilter === 'all' || activity.responsavel === responsibleFilter;
            const statusMatch = statusFilter === 'all' || (statusFilter === 'pending' && isActivityPending(activity));
            return categoryMatch && recurrenceMatch && responsibleMatch && statusMatch;
        });
    }, [allActivities, categoryFilter, recurrenceFilter, responsibleFilter, statusFilter]);

    const groupedActivities = useMemo(() => {
        const groups = {} as Record<Recurrence, Activity[]>;
        for (const recurrence of recurrenceOrder) {
            groups[recurrence] = [];
        }

        for (const activity of filteredActivities) {
            if (activity.recorrencia && groups[activity.recorrencia]) {
                groups[activity.recorrencia].push(activity);
            }
        }
        return groups;
    }, [filteredActivities]);

    const stats = useMemo(() => {
        const total = filteredActivities.length;
        const pending = filteredActivities.filter(isActivityPending).length;
        const executed = total - pending;
        const completionRate = total > 0 ? (executed / total) * 100 : 0;
        return { total, pending, executed, completionRate };
    }, [filteredActivities]);

    if (userLoading || isLoading) {
        return (
            <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }
    
    if (allActivities.length === 0) {
        return (
           <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={false}>
            <div className="text-center py-20">
              <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade aprovada</h1>
              <p className="mt-2 text-lg text-muted-foreground">Classifique e aprove atividades para popular o checklist operacional.</p>
              <Button onClick={() => router.push('/classificacao')} className="mt-6">
                Ir para Classificação
              </Button>
            </div>
          </AppLayout>
        )
    }

    return (
        <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Checklist Operacional</h1>
                <p className="mt-4 text-lg text-muted-foreground">Acompanhe a execução das atividades recorrentes da equipe.</p>
            </motion.div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 my-8">
                <StatCard title="Total de Atividades" value={stats.total} icon={<Calendar className="h-6 w-6 text-muted-foreground" />} />
                <StatCard title="Executadas no Período" value={stats.executed} icon={<CheckSquare className="h-6 w-6 text-green-500" />} />
                <StatCard title="Pendentes" value={stats.pending} icon={<Clock className="h-6 w-6 text-yellow-500" />} />
                <StatCard title="Taxa de Conclusão" value={`${Math.round(stats.completionRate)}%`} icon={<Progress value={stats.completionRate} className="w-12 h-3" /> } />
            </div>

             <Tabs value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as any)}>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <TabsList>
                        <TabsTrigger value="Todas">Todas</TabsTrigger>
                        <TabsTrigger value="DP">DP</TabsTrigger>
                        <TabsTrigger value="RH">RH</TabsTrigger>
                        <TabsTrigger value="Compartilhado">Compartilhado</TabsTrigger>
                    </TabsList>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Select value={recurrenceFilter} onValueChange={setRecurrenceFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por recorrência" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas Recorrências</SelectItem>
                                {allRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Responsáveis</SelectItem>
                                {allResponsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Mostrar Todas</SelectItem>
                                <SelectItem value="pending">Mostrar Apenas Pendentes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="mt-6 space-y-6">
                    {recurrenceOrder.map(recurrence => (
                         <RecurrenceGroup
                             key={recurrence}
                             title={recurrence}
                             activities={groupedActivities[recurrence] || []}
                             onToggle={handleToggleActivity}
                         />
                     ))}
                     {filteredActivities.length === 0 && !isLoading && (
                        <div className="text-center py-20 border-2 border-dashed rounded-lg">
                            <h3 className="text-xl font-semibold">Nenhuma atividade encontrada</h3>
                            <p className="mt-2 text-muted-foreground">Tente ajustar os filtros ou adicione mais atividades.</p>
                        </div>
                     )}
                 </div>
            </Tabs>
        </AppLayout>
    );
}
