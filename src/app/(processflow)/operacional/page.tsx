"use client";

import { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, User, Repeat, CheckSquare, Clock, ChevronsDown, History, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { isActivityPending, isActivityOverdue, getNextExecution, type Recurrence } from '@/lib/date-utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';


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

const categoryStyles: Record<string, string> = {
    DP: 'bg-purple-100 text-purple-800 border-purple-200',
    RH: 'bg-green-100 text-green-800 border-green-200',
    Compartilhado: 'bg-blue-100 text-blue-800 border-blue-200',
};

function ActivityItem({ activity, name, onToggle }: { activity: Activity, name: string, onToggle: (id: string, isPending: boolean) => void }) {
    const isPending = isActivityPending(activity);
    const isOverdue = isPending && isActivityOverdue(activity);
    const nextExecution = getNextExecution(activity);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = () => {
        setIsUpdating(true);
        onToggle(activity.id, isPending);
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
                <label htmlFor={`activity-${activity.id}`} className="font-semibold text-lg cursor-pointer">{name}</label>
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
             <div className="flex flex-col items-end gap-2">
                 {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
                 <HistoryModal activity={activity} name={name} />
            </div>
        </motion.div>
    );
}

function HistoryModal({ activity, name }: { activity: Activity, name: string }) {
    const history = useMemo(() => {
        if (!activity.historicoExecucoes) return [];
        const sorted = [...(activity.historicoExecucoes || [])];
        sorted.sort((a, b) => {
            const dateA = a instanceof Timestamp ? a.toDate() : new Date(a);
            const dateB = b instanceof Timestamp ? b.toDate() : new Date(b);
            return dateB.getTime() - dateA.getTime();
        });
        return sorted;
    }, [activity.historicoExecucoes]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-auto">
                    <History className="h-4 w-4 mr-2" />
                    Histórico
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Histórico de Execução</DialogTitle>
                    <DialogDescription>{name}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-80">
                    <div className="pr-6">
                        {history.length > 0 ? (
                            <ul className="space-y-3">
                                {history.map((item, index) => (
                                    <li key={index} className="flex items-center gap-4 text-sm">
                                        <ListChecks className="h-5 w-5 text-green-500" />
                                        <div className="flex-1">
                                            <p className="font-medium">Execução concluída</p>
                                            <p className="text-muted-foreground text-xs">
                                                {format(item instanceof Timestamp ? item.toDate() : new Date(item), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-muted-foreground">Nenhuma execução registrada.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}


function RecurrenceGroup({ title, activities, onToggle, getActivityName }: { title: Recurrence, activities: Activity[], onToggle: (id: string, isPending: boolean) => void, getActivityName: (act: Activity) => string }) {
    const [isOpen, setIsOpen] = useState(true);
    const completed = activities.filter(a => !isActivityPending(a)).length;
    const total = activities.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    if (activities.length === 0) return null;

    return (
        <Card className="overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-muted/50 p-4 gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold">{title}</h2>
                            <Badge variant="secondary">{activities.length} atividades</Badge>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <span className="text-sm text-muted-foreground hidden lg:inline">{completed} de {total} concluídas</span>
                            <Progress value={progress} className="w-full sm:w-32 h-2" />
                            <Button variant="ghost" size="sm" className="w-9 p-0">
                                <ChevronsDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
                            </Button>
                        </div>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <CardContent className="p-4 space-y-3">
                         <AnimatePresence>
                            {activities.map(activity => (
                                <ActivityItem key={activity.id} activity={activity} name={getActivityName(activity)} onToggle={onToggle} />
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
    const { clientId, isClientLoading } = useClient();
    const router = useRouter();
    const { toast } = useToast();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, startUpdateTransition] = useTransition();

    const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
    const [recurrenceFilter, setRecurrenceFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('pending'); // 'all', 'pending'

    const isLoadingPage = userLoading || isClientLoading;

    useEffect(() => {
        if (isLoadingPage) {
            setIsLoading(true);
            return;
        }
        if (!user) {
            router.push('/login');
            return;
        }
        if (!db || !clientId) {
            setIsLoading(false);
            setAllActivities([]);
            return;
        }

        setIsLoading(true);
        const q = query(collection(db, 'clients', clientId, 'activities'), where('status', '==', 'aprovada'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setAllActivities(activitiesData);
            setIsLoading(false);
        }, () => setIsLoading(false));

        return () => unsubscribe();
    }, [db, user, router, clientId, isLoadingPage]);

    const handleToggleActivity = (activityId: string, isCurrentlyPending: boolean) => {
        if (!db || !clientId) return;
        startUpdateTransition(async () => {
            try {
                const docRef = doc(db, 'clients', clientId, 'activities', activityId);
                
                const updateData: any = {
                    ultimaExecucao: isCurrentlyPending ? serverTimestamp() : null
                };

                if (isCurrentlyPending) {
                   updateData.historicoExecucoes = arrayUnion(new Date());
                }
                
                await updateDoc(docRef, updateData);

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
    
    const allResponsibles = useMemo(() => Array.from(new Set(allActivities.map(a => a.responsavel).filter(Boolean))), [allActivities]);
    
    const allRecurrences = useMemo(() => {
        const recurrences = new Set(allActivities.map(a => a.recorrencia).filter(Boolean));
        return recurrenceOrder.filter(r => recurrences.has(r));
    }, [allActivities]);

    const getActivityName = (activity: Activity) => {
        if (activity.parentId) {
            const parent = allActivities.find(a => a.id === activity.parentId);
            return parent ? `${parent.nome} » ${activity.nome}` : activity.nome;
        }
        return activity.nome;
    };


    const filteredActivities = useMemo(() => {
        return allActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'Todas' || activity.categoria === categoryFilter;
            const recurrenceMatch = recurrenceFilter === 'all' || activity.recorrencia === recurrenceFilter;
            const responsibleMatch = responsibleFilter === 'all' || activity.responsavel === responsibleFilter;
            const statusMatch = statusFilter === 'all' || (statusFilter === 'pending' && isActivityPending(activity)) || (statusFilter === 'executed' && !isActivityPending(activity));
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
        
        for (const recurrence in groups) {
            groups[recurrence as Recurrence].sort((a,b) => {
                const aIsPending = isActivityPending(a);
                const bIsPending = isActivityPending(b);
                if (aIsPending && !bIsPending) return -1;
                if (!aIsPending && bIsPending) return 1;
                return 0;
            });
        }
        return groups;
    }, [filteredActivities]);

    const stats = useMemo(() => {
        const total = allActivities.length;
        const pending = allActivities.filter(isActivityPending).length;
        const executed = total - pending;
        const completionRate = total > 0 ? (executed / total) * 100 : 0;
        return { total, pending, executed, completionRate };
    }, [allActivities]);

    if (isLoadingPage || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] w-full">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (allActivities.length === 0 && !isClientLoading) {
        return (
           <div className="text-center py-20 flex-1">
            <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade aprovada</h1>
            <p className="mt-2 text-lg text-muted-foreground">Classifique e aprove atividades para popular o checklist operacional.</p>
            <Button onClick={() => router.push('/processflow/classificacao')} className="mt-6">
              Ir para Classificação
            </Button>
          </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto w-full">
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
                          <SelectTrigger className="w-full sm:w-auto">
                              <SelectValue placeholder="Filtrar por recorrência" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todas Recorrências</SelectItem>
                              {allRecurrences.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                          <SelectTrigger className="w-full sm:w-auto">
                              <SelectValue placeholder="Filtrar por responsável" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos Responsáveis</SelectItem>
                              {allResponsibles.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-auto">
                              <SelectValue placeholder="Filtrar por status" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Mostrar Todas</SelectItem>
                              <SelectItem value="pending">Apenas Pendentes</SelectItem>
                              <SelectItem value="executed">Apenas Executadas</SelectItem>
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
                            getActivityName={(act) => getActivityName(act)}
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
        </div>
    );
}
