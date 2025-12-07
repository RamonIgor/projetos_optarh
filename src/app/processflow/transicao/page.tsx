"use client";

import { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, PlayCircle, Clock, Calendar, Shuffle, BarChart3, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


const transitionStatusConfig: Record<Activity['statusTransicao'] | 'undefined', { label: string; color: string; icon: React.ReactNode }> = {
    a_transferir: { label: 'Aguardando', color: 'bg-gray-200 text-gray-800', icon: <Clock className="h-4 w-4 text-gray-500" /> },
    em_transicao: { label: 'Em Transição', color: 'bg-yellow-200 text-yellow-800', icon: <PlayCircle className="h-4 w-4 text-yellow-600" /> },
    concluida: { label: 'Concluída', color: 'bg-green-200 text-green-800', icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
    undefined: { label: 'Indefinido', color: 'bg-gray-100 text-gray-500', icon: <AlertCircle className="h-4 w-4 text-gray-400" /> },
};


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


function EditTransitionModal({ activity, children }: { activity: Activity, children: React.ReactNode }) {
    const db = useFirestore();
    const { clientId } = useClient();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [open, setOpen] = useState(false);

    const [prazo, setPrazo] = useState<Date | undefined>(activity.prazoTransicao ? (activity.prazoTransicao as any).toDate() : undefined);
    const [responsavelAnterior, setResponsavelAnterior] = useState(activity.responsavelAnterior || '');
    const [status, setStatus] = useState<Activity['statusTransicao']>(activity.statusTransicao);

    useEffect(() => {
        if(open) {
            setPrazo(activity.prazoTransicao ? (activity.prazoTransicao as any).toDate() : undefined);
            setResponsavelAnterior(activity.responsavelAnterior || '');
            setStatus(activity.statusTransicao);
        }
    }, [open, activity]);
    
    const handleSave = async () => {
        if (!db || !clientId) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'clients', clientId, 'activities', activity.id);

            const data: Partial<Activity> = {
                prazoTransicao: prazo,
                responsavelAnterior: responsavelAnterior,
                statusTransicao: status,
            };

            if (status !== activity.statusTransicao) {
                if(status === 'em_transicao') {
                    data.dataInicioTransicao = serverTimestamp();
                } else if (status === 'concluida') {
                    data.dataConclusaoTransicao = serverTimestamp();
                }
            }
            
            await updateDoc(docRef, data);

            toast({ title: "Alterações salvas com sucesso!" });
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Editar Transição</DialogTitle>
                    <DialogDescription>{activity.nome}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="prev-responsible" className="text-right">
                            Resp. Anterior
                        </Label>
                        <Input
                            id="prev-responsible"
                            value={responsavelAnterior}
                            onChange={(e) => setResponsavelAnterior(e.target.value)}
                            className="col-span-3"
                            placeholder="Quem realizava a tarefa?"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            Prazo
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "col-span-3 justify-start text-left font-normal",
                                        !prazo && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {prazo ? format(prazo, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={prazo}
                                    onSelect={setPrazo}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">
                            Status
                        </Label>
                         <Select value={status} onValueChange={(value) => setStatus(value as Activity['statusTransicao'])}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(transitionStatusConfig).map(([key, config]) => (
                                    (key !== 'undefined') && <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                     <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function TransitionPage() {
    const db = useFirestore();
    const { user, loading: userLoading } = useUser();
    const { clientId, isClientLoading } = useClient();
    const router = useRouter();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    
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

        const q = query(collection(db, 'clients', clientId, 'activities'), where('status', '==', 'aprovada'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            const sortedActivities = activitiesData.sort((a, b) => ((a.createdAt as any)?.seconds || 0) - ((b.createdAt as any)?.seconds || 0));
            setAllActivities(sortedActivities);
            setIsLoading(false);
        }, () => setIsLoading(false));

        return () => unsubscribe();
    }, [db, user, router, clientId, isLoadingPage]);
    
    const getActivityName = (activity: Activity, all: Activity[]) => {
        if (activity.parentId) {
            const parent = all.find(a => a.id === activity.parentId);
            return parent ? `${parent.nome} » ${activity.nome}` : activity.nome;
        }
        return activity.nome;
    };
    
    const unclassifiedCount = 0; // On this page, all are classified/approved.
    const allResponsibles = useMemo(() => Array.from(new Set(allActivities.map(a => a.responsavel).filter(Boolean))), [allActivities]);

    const filteredActivities = useMemo(() => {
        return allActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'all' || activity.categoria === categoryFilter;
            const statusMatch = statusFilter === 'all' || activity.statusTransicao === statusFilter;
            const responsibleMatch = responsibleFilter === 'all' || activity.responsavel === responsibleFilter;
            return categoryMatch && statusMatch && responsibleMatch;
        });
    }, [allActivities, categoryFilter, statusFilter, responsibleFilter]);
    
    const stats = useMemo(() => {
        const total = allActivities.length;
        const toTransfer = allActivities.filter(a => a.statusTransicao === 'a_transferir').length;
        const inTransition = allActivities.filter(a => a.statusTransicao === 'em_transicao').length;
        const concluded = allActivities.filter(a => a.statusTransicao === 'concluida').length;
        const overdue = allActivities.filter(a => a.prazoTransicao && a.statusTransicao !== 'concluida' && isPast((a.prazoTransicao as any).toDate())).length;
        const progress = total > 0 ? (concluded / total) * 100 : 0;
        return { total, toTransfer, inTransition, concluded, overdue, progress };
    }, [allActivities]);
    
    if (isLoadingPage || isLoading) {
        return (
            <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
                <div className="flex items-center justify-center min-h-[60vh] w-full">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }
    
    if (allActivities.length === 0 && !isClientLoading) {
        return (
           <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={false}>
            <div className="text-center py-20">
              <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade aprovada</h1>
              <p className="mt-2 text-lg text-muted-foreground">Classifique e aprove atividades para iniciar o plano de transição.</p>
              <Button onClick={() => router.push('/processflow/classificacao')} className="mt-6">
                Ir para Classificação
              </Button>
            </div>
          </AppLayout>
        )
    }

    return (
        <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
          <div className="max-w-7xl mx-auto w-full">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Plano de Transição</h1>
                <p className="mt-4 text-lg text-muted-foreground">Acompanhe a transferência de responsabilidades das atividades aprovadas.</p>
            </motion.div>
            
             <div className="my-8">
                <Progress value={stats.progress} />
                <p className="text-right text-sm text-muted-foreground mt-2">{Math.round(stats.progress)}% das transições concluídas</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
                <StatCard title="Atividades no Plano" value={stats.total} icon={<Shuffle className="h-6 w-6 text-muted-foreground" />} />
                <StatCard title="Aguardando Transição" value={stats.toTransfer} icon={<Clock className="h-6 w-6 text-gray-500" />} />
                <StatCard title="Em Transição" value={stats.inTransition} icon={<PlayCircle className="h-6 w-6 text-yellow-500" />} />
                <StatCard title="Concluídas" value={stats.concluded} icon={<CheckCircle2 className="h-6 w-6 text-green-500" />} />
                <StatCard title="Atrasadas" value={stats.overdue} icon={<AlertCircle className="h-6 w-6 text-red-500" />} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filtrar por categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Categorias</SelectItem>
                                <SelectItem value="DP">DP</SelectItem>
                                <SelectItem value="RH">RH</SelectItem>
                                <SelectItem value="Compartilhado">Compartilhado</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filtrar por status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Status</SelectItem>
                                {Object.entries(transitionStatusConfig).map(([key, config]) => (
                                    (key !== 'undefined') && <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filtrar por responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Responsáveis</SelectItem>
                                {allResponsibles.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%]">Atividade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Responsáveis</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredActivities.length > 0 ? filteredActivities.map(activity => {
                                const statusConfig = transitionStatusConfig[activity.statusTransicao] || transitionStatusConfig.undefined;
                                const categoryStyles = {
                                    DP: 'bg-purple-100 text-purple-800 border-purple-200',
                                    RH: 'bg-green-100 text-green-800 border-green-200',
                                    Compartilhado: 'bg-blue-100 text-blue-800 border-blue-200',
                                };
                                return (
                                <TableRow key={activity.id}>
                                    <TableCell className="font-medium">{getActivityName(activity, allActivities)}</TableCell>
                                    <TableCell>
                                         <Badge variant="outline" className={cn(activity.categoria ? categoryStyles[activity.categoria as keyof typeof categoryStyles] : '')}>
                                            {activity.categoria}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{activity.responsavel}</span>
                                            {activity.responsavelAnterior && <span className="text-xs text-muted-foreground">de: {activity.responsavelAnterior}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {activity.prazoTransicao ? format((activity.prazoTransicao as any).toDate(), 'dd/MM/yyyy') : <span className="text-muted-foreground">-</span>}
                                        {activity.prazoTransicao && isPast((activity.prazoTransicao as any).toDate()) && activity.statusTransicao !== 'concluida' && (
                                            <p className="text-xs text-red-500">Atrasado</p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(statusConfig.color, "whitespace-nowrap")}>
                                            {statusConfig.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <EditTransitionModal activity={activity}>
                                            <Button size="sm" variant="ghost">
                                                <Edit className="h-4 w-4 mr-2" />
                                                Editar
                                            </Button>
                                        </EditTransitionModal>
                                    </TableCell>
                                </TableRow>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Nenhuma atividade encontrada com os filtros selecionados.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </div>
        </AppLayout>
    );
}

    

    




