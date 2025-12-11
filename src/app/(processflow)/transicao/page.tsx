
"use client";

import { useState, useEffect, useMemo, useTransition, Fragment } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, PlayCircle, Clock, Calendar, Shuffle, Edit, User, Users, CornerDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
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

            const data: any = {
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
        
        const q = query(
            collection(db, 'clients', clientId, 'activities'), 
            where('status', '==', 'aprovada')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            const sortedActivities = activitiesData.sort((a, b) => ((a.createdAt as any)?.seconds || 0) - ((b.createdAt as any)?.seconds || 0));
            setAllActivities(sortedActivities);
            setIsLoading(false);
        }, () => setIsLoading(false));

        return () => unsubscribe();
    }, [db, user, router, clientId, isLoadingPage]);
    
    const mainActivities = useMemo(() => allActivities.filter(a => !a.parentId), [allActivities]);

    const allResponsibles = useMemo(() => Array.from(new Set(mainActivities.map(a => a.responsavel).filter(Boolean))), [mainActivities]);

    const filteredMainActivities = useMemo(() => {
        return mainActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'all' || activity.categoria === categoryFilter;
            const statusMatch = statusFilter === 'all' || activity.statusTransicao === statusFilter;
            const responsibleMatch = responsibleFilter === 'all' || activity.responsavel === responsibleFilter;
            return categoryMatch && statusMatch && responsibleMatch;
        });
    }, [mainActivities, categoryFilter, statusFilter, responsibleFilter]);

    const activitiesWithChildren = useMemo(() => {
        return filteredMainActivities.map(main => ({
            ...main,
            children: allActivities.filter(child => child.parentId === main.id)
        }));
    }, [filteredMainActivities, allActivities]);
    
    const stats = useMemo(() => {
        const total = mainActivities.length;
        const toTransfer = mainActivities.filter(a => a.statusTransicao === 'a_transferir').length;
        const inTransition = mainActivities.filter(a => a.statusTransicao === 'em_transicao').length;
        const concluded = mainActivities.filter(a => a.statusTransicao === 'concluida').length;
        const overdue = mainActivities.filter(a => a.prazoTransicao && a.statusTransicao !== 'concluida' && isPast((a.prazoTransicao as any).toDate())).length;
        const progress = total > 0 ? (concluded / total) * 100 : 0;
        return { total, toTransfer, inTransition, concluded, overdue, progress };
    }, [mainActivities]);
    
    if (isLoadingPage || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] w-full">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (mainActivities.length === 0 && !isClientLoading) {
        return (
           <div className="text-center py-20 flex-1">
            <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade aprovada</h1>
            <p className="mt-2 text-lg text-muted-foreground">Classifique e aprove atividades para iniciar o plano de transição.</p>
            <Button onClick={() => router.push('/classificacao')} className="mt-6">
              Ir para Classificação
            </Button>
          </div>
        )
    }

    const categoryStyles: Record<string, string> = {
        DP: 'bg-purple-100 text-purple-800 border-purple-200',
        RH: 'bg-green-100 text-green-800 border-green-200',
        Compartilhado: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    return (
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
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h2 className="text-xl font-bold">Lista de Atividades</h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
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
                            <SelectTrigger className="w-full sm:w-[180px]">
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
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Responsáveis</SelectItem>
                                {allResponsibles.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%] min-w-[250px]">Atividade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Responsáveis</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activitiesWithChildren.length > 0 ? activitiesWithChildren.map(activity => {
                                const statusConfig = transitionStatusConfig[activity.statusTransicao] || transitionStatusConfig.undefined;
                                return (
                                <Fragment key={activity.id}>
                                    <TableRow>
                                        <TableCell className="font-medium">{activity.nome}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(activity.categoria ? categoryStyles[activity.categoria] : '')}>
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
                                    {activity.children.map(child => (
                                        <TableRow key={child.id} className="bg-muted/50">
                                            <TableCell className="pl-10">
                                                <div className="flex items-center gap-2">
                                                    <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">{child.nome}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <User className="h-4 w-4" />
                                                    {child.responsavel}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {child.prazo && (
                                                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Calendar className="h-4 w-4" />
                                                        {format((child.prazo as any).toDate(), 'dd/MM/yyyy')}
                                                   </div>
                                                )}
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    ))}
                                </Fragment>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Nenhuma atividade encontrada com os filtros selecionados.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                  </div>
                  
                  {/* Mobile Card List */}
                  <div className="md:hidden space-y-4">
                        {activitiesWithChildren.length > 0 ? activitiesWithChildren.map(activity => {
                             const statusConfig = transitionStatusConfig[activity.statusTransicao] || transitionStatusConfig.undefined;
                             return (
                                <Card key={activity.id} className="bg-card">
                                    <CardHeader>
                                        <CardTitle>{activity.nome}</CardTitle>
                                        <div className="flex items-center gap-2 pt-2">
                                            <Badge variant="outline" className={cn(activity.categoria ? categoryStyles[activity.categoria] : '')}>
                                                {activity.categoria}
                                            </Badge>
                                            <Badge variant="outline" className={cn(statusConfig.color, "whitespace-nowrap")}>
                                                {statusConfig.label}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div>
                                            <Label className="text-xs font-semibold">Responsáveis</Label>
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-muted-foreground"/>
                                                <div>
                                                    <p className="font-medium">{activity.responsavel}</p>
                                                    {activity.responsavelAnterior && <p className="text-xs text-muted-foreground">Anterior: {activity.responsavelAnterior}</p>}
                                                </div>
                                            </div>
                                        </div>
                                         <div>
                                            <Label className="text-xs font-semibold">Prazo</Label>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground"/>
                                                <div>
                                                    <p>{activity.prazoTransicao ? format((activity.prazoTransicao as any).toDate(), 'dd/MM/yyyy') : <span className="text-muted-foreground">-</span>}</p>
                                                     {activity.prazoTransicao && isPast((activity.prazoTransicao as any).toDate()) && activity.statusTransicao !== 'concluida' && (
                                                        <p className="text-xs text-red-500">Atrasado</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {activity.children.length > 0 && (
                                            <div className="pt-2">
                                                <Label className="text-xs font-semibold">Micro-processos</Label>
                                                <ul className="list-disc list-inside space-y-1 pl-2 text-muted-foreground">
                                                    {activity.children.map(child => (
                                                        <li key={child.id}>{child.nome} ({child.responsavel})</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter>
                                        <EditTransitionModal activity={activity}>
                                            <Button size="sm" variant="outline" className="w-full">
                                                <Edit className="h-4 w-4 mr-2" />
                                                Editar Transição
                                            </Button>
                                        </EditTransitionModal>
                                    </CardFooter>
                                </Card>
                             )
                        }) : (
                            <div className="text-center py-16">
                                <p className="text-muted-foreground">Nenhuma atividade encontrada.</p>
                            </div>
                        )}
                  </div>
              </CardContent>
          </Card>
        </div>
    );
}
