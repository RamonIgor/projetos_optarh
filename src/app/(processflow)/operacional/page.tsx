
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
import { Loader2, Calendar as CalendarIcon, User, Repeat, CheckSquare, Clock, ChevronsDown, History, ListChecks, CalendarPlus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { isActivityPending, isActivityOverdue, getNextExecution, type Recurrence } from '@/lib/date-utils';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';


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

const recurrenceOrder: Recurrence[] = ['Diária', 'Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Sob demanda'];

const categoryStyles: Record<string, string> = {
    DP: 'border-purple-200 bg-purple-50 text-purple-800',
    RH: 'border-green-200 bg-green-50 text-green-800',
    Compartilhado: 'border-blue-200 bg-blue-50 text-blue-800',
};


function SubActivityItem({ activity, onToggle, onUpdatePrazo }: { activity: Activity, onToggle: (id: string, isPending: boolean) => void, onUpdatePrazo: (id: string, prazo: Date) => void }) {
    const isPending = isActivityPending(activity);
    const isOverdue = isPending && isActivityOverdue(activity);
    const [isUpdating, setIsUpdating] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    
    const handleToggle = () => {
        setIsUpdating(true);
        onToggle(activity.id, isPending);
        setTimeout(() => setIsUpdating(false), 1000);
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            onUpdatePrazo(activity.id, date);
        }
        setCalendarOpen(false);
    };

    return (
        <div className="flex items-start gap-3 pl-8 py-3 border-t">
            <Checkbox 
                id={`sub-activity-${activity.id}`}
                checked={!isPending}
                onCheckedChange={handleToggle}
                className="h-5 w-5 mt-0.5"
                disabled={isUpdating}
            />
            <div className="flex-1">
                 <label htmlFor={`sub-activity-${activity.id}`} className={cn("font-medium text-sm cursor-pointer", !isPending && "line-through text-muted-foreground")}>
                    {activity.nome}
                </label>
                <div className="flex items-center gap-x-3 text-xs text-muted-foreground mt-1">
                    <div className="flex items-center gap-1"><User className="h-3 w-3"/> {activity.responsavel}</div>
                     {activity.recorrencia === 'Sob demanda' && activity.prazo && (
                       <div className={cn("flex items-center gap-1", isOverdue && "text-red-500 font-semibold")}>
                          <CalendarIcon className="h-3 w-3"/> 
                          Prazo: {format((activity.prazo as Timestamp).toDate(), 'dd/MM/yyyy')}
                       </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {isOverdue && <Badge variant="destructive" className="h-5">Atrasada</Badge>}
                {activity.recorrencia === 'Sob demanda' && (
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Alterar Prazo</p></TooltipContent>
                           </Tooltip>
                        </TooltipProvider>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={activity.prazo ? (activity.prazo as Timestamp).toDate() : undefined}
                                onSelect={handleDateSelect}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    )
}

function ActivityCard({ activity, children, onToggle }: { activity: Activity, children: Activity[], onToggle: (id: string, isPending: boolean) => void }) {
    const isPending = isActivityPending(activity);
    const isOverdue = isPending && isActivityOverdue(activity);
    const nextExecution = getNextExecution(activity);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = () => {
        setIsUpdating(true);
        onToggle(activity.id, isPending);
        setTimeout(() => setIsUpdating(false), 1000);
    };

    const borderColor = isOverdue ? "border-red-500" : !isPending ? "border-green-500" : "border-transparent";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={cn("bg-card rounded-xl border-l-4 transition-colors", borderColor)}
        >
            <div className="flex items-start gap-4 p-4">
                <Checkbox 
                    id={`activity-${activity.id}`}
                    checked={!isPending}
                    onCheckedChange={handleToggle}
                    className="h-6 w-6 mt-1"
                    disabled={isUpdating}
                />
                <div className="flex-1">
                    <label htmlFor={`activity-${activity.id}`} className={cn("font-semibold text-lg cursor-pointer", !isPending && "line-through text-muted-foreground")}>{activity.nome}</label>
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {activity.responsavel}</div>
                        {activity.recorrencia && <div className="flex items-center gap-1.5"><Repeat className="h-3 w-3" /> {activity.recorrencia}</div>}
                    </div>
                     <div className="text-xs text-muted-foreground mt-2 space-y-1">
                       {activity.ultimaExecucao && (
                         <p>
                            Última execução: {formatDistanceToNow((activity.ultimaExecucao as Timestamp).toDate(), { addSuffix: true, locale: ptBR })}
                         </p>
                       )}
                       {nextExecution && (
                         <p className={cn(isOverdue && 'text-red-500 font-medium')}>
                            {isOverdue ? 'Execução atrasada!' : `Próxima execução: ${formatDistanceToNow(nextExecution, { addSuffix: true, locale: ptBR })}`}
                         </p>
                       )}
                    </div>
                </div>
                 <div className="flex flex-col items-end gap-2">
                    {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
                    <HistoryModal activity={activity} />
                </div>
            </div>
            {children}
        </motion.div>
    )
}

function HistoryModal({ activity }: { activity: Activity }) {
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
                <Button variant="ghost" size="sm">
                    <History className="h-4 w-4 mr-2" />
                    Histórico
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Histórico de Execução</DialogTitle>
                    <DialogDescription>{activity.nome}</DialogDescription>
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

function RecurrenceGroup({ title, activities, onToggle, onUpdatePrazo }: { title: Recurrence, activities: (Activity & { children: Activity[] })[], onToggle: (id: string, isPending: boolean) => void, onUpdatePrazo: (id: string, prazo: Date) => void }) {
    const [isOpen, setIsOpen] = useState(true);
    
    if (activities.length === 0) return null;

    const completed = activities.filter(a => !isActivityPending(a)).length;
    const total = activities.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return (
         <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4">
            <CollapsibleTrigger asChild>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-muted/50 p-4 gap-4 rounded-lg border">
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
                <div className="space-y-4">
                     <AnimatePresence>
                        {activities.map(activity => (
                             <ActivityCard key={activity.id} activity={activity} onToggle={onToggle}>
                                {activity.children.length > 0 && (
                                     <div>
                                        {activity.children.map(child => (
                                            <SubActivityItem key={child.id} activity={child} onToggle={onToggle} onUpdatePrazo={onUpdatePrazo} />
                                        ))}
                                    </div>
                                )}
                             </ActivityCard>
                        ))}
                    </AnimatePresence>
                </div>
            </CollapsibleContent>
        </Collapsible>
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

    const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
    const [recurrenceFilter, setRecurrenceFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

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

    const handleToggleActivity = async (activityId: string, isCurrentlyPending: boolean) => {
        if (!db || !clientId) return;
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
    };
    
    const handleUpdatePrazo = async (activityId: string, prazo: Date) => {
        if (!db || !clientId) return;
        try {
            const docRef = doc(db, 'clients', clientId, 'activities', activityId);
            await updateDoc(docRef, { prazo: prazo });
            toast({
                title: "Prazo atualizado!",
                description: `O novo prazo foi definido para ${format(prazo, "dd/MM/yyyy")}.`,
            });
        } catch (error) {
            console.error("Error updating deadline:", error);
            toast({ title: 'Erro ao atualizar prazo', variant: 'destructive' });
        }
    };
    
    const allResponsibles = useMemo(() => Array.from(new Set(allActivities.map(a => a.responsavel).filter(Boolean) as string[])), [allActivities]);
    const allRecurrences = useMemo(() => recurrenceOrder.filter(r => new Set(allActivities.map(a => a.recorrencia)).has(r)), [allActivities]);
    const mainActivities = useMemo(() => allActivities.filter(a => !a.parentId), [allActivities]);

    const filteredMainActivities = useMemo(() => {
        return mainActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'Todas' || activity.categoria === categoryFilter;
            const recurrenceMatch = recurrenceFilter === 'all' || activity.recorrencia === recurrenceFilter;
            const responsibleMatch = responsibleFilter === 'all' || activity.responsavel === responsibleFilter;
            
            let statusMatch = true;
            if (statusFilter === 'pending') statusMatch = isActivityPending(activity);
            if (statusFilter === 'executed') statusMatch = !isActivityPending(activity);
            if (statusFilter === 'overdue') statusMatch = isActivityPending(activity) && isActivityOverdue(activity);
            
            return categoryMatch && recurrenceMatch && responsibleMatch && statusMatch;
        });
    }, [mainActivities, categoryFilter, recurrenceFilter, responsibleFilter, statusFilter]);

    const activityTree = useMemo(() => {
        const childrenOf: Record<string, Activity[]> = {};
        allActivities.forEach(activity => {
            if (activity.parentId) {
                if (!childrenOf[activity.parentId]) childrenOf[activity.parentId] = [];
                childrenOf[activity.parentId].push(activity);
            }
        });
        
        return filteredMainActivities.map(main => ({
            ...main,
            children: (childrenOf[main.id] || []).sort((a,b) => ((a.createdAt as any)?.seconds || 0) - ((b.createdAt as any)?.seconds || 0)),
        }));
    }, [filteredMainActivities, allActivities]);
    
    const groupedByRecurrence = useMemo(() => {
        const groups = recurrenceOrder.reduce((acc, r) => ({...acc, [r]: []}), {} as Record<Recurrence, (Activity & {children: Activity[]})[]>);
        activityTree.forEach(activity => {
             if (activity.recorrencia && groups[activity.recorrencia]) {
                groups[activity.recorrencia].push(activity);
            }
        });
        return groups;
    }, [activityTree]);

    const stats = useMemo(() => {
        const total = mainActivities.length;
        const pending = mainActivities.filter(isActivityPending).length;
        const overdue = mainActivities.filter(a => isActivityPending(a) && isActivityOverdue(a)).length;
        const executed = total - pending;
        const completionRate = total > 0 ? (executed / total) * 100 : 0;
        return { total, pending, executed, overdue, completionRate };
    }, [mainActivities]);

    if (isLoadingPage || isLoading) {
        return <div className="flex items-center justify-center min-h-[60vh] w-full"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    
    if (mainActivities.length === 0 && !isClientLoading) {
        return (
           <div className="text-center py-20 flex-1">
            <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade aprovada</h1>
            <p className="mt-2 text-lg text-muted-foreground">Classifique e aprove atividades para popular o checklist operacional.</p>
            <Button onClick={() => router.push('/classificacao')} className="mt-6">Ir para Classificação</Button>
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
              <StatCard title="Total de Atividades" value={stats.total} icon={<CalendarIcon className="h-6 w-6 text-muted-foreground" />} />
              <StatCard title="Executadas no Período" value={stats.executed} icon={<CheckSquare className="h-6 w-6 text-green-500" />} />
              <StatCard title="Pendentes" value={stats.pending} icon={<Clock className="h-6 w-6 text-yellow-500" />} />
              <StatCard title="Atrasadas" value={stats.overdue} icon={<AlertTriangle className="h-6 w-6 text-red-500" />} />
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
                          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por recorrência" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todas Recorrências</SelectItem>
                              {allRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por responsável" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos Responsáveis</SelectItem>
                              {allResponsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos os Status</SelectItem>
                              <SelectItem value="pending">Apenas Pendentes</SelectItem>
                              <SelectItem value="executed">Apenas Executadas</SelectItem>
                              <SelectItem value="overdue">Apenas Atrasadas</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
                <div className="mt-6 space-y-6">
                  {recurrenceOrder.map(recurrence => (
                        <RecurrenceGroup
                            key={recurrence}
                            title={recurrence}
                            activities={groupedByRecurrence[recurrence] || []}
                            onToggle={handleToggleActivity}
                            onUpdatePrazo={handleUpdatePrazo}
                        />
                    ))}
                    {activityTree.length === 0 && !isLoading && (
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
