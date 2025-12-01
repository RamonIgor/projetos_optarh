"use client";

import { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { type ConsultancyAction } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, CalendarIcon, Trash2, Edit, BarChart, LineChart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Bar, XAxis, YAxis, CartesianGrid, ComposedChart } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const actionSchema = z.object({
  acao: z.string().min(3, "A ação deve ter pelo menos 3 caracteres."),
  como_sera_realizada: z.string().optional(),
  responsavel: z.string().min(2, "O responsável é obrigatório."),
  data_inicio: z.date({ required_error: "A data de início é obrigatória." }),
  data_termino: z.date({ required_error: "A data de término é obrigatória." }),
  percentual_concluido: z.number().min(0).max(100),
  status: z.enum(["nao_iniciada", "em_andamento", "concluida", "atrasada", "cancelada"]),
  observacoes: z.string().optional(),
});

type ActionFormValues = z.infer<typeof actionSchema>;

const ACTIONS_COLLECTION = 'consultancy-actions';

const statusConfig: Record<ConsultancyAction['status'], { label: string; color: string }> = {
    nao_iniciada: { label: 'Não iniciada', color: 'bg-gray-500' },
    em_andamento: { label: 'Em andamento', color: 'bg-blue-500' },
    concluida: { label: 'Concluída', color: 'bg-green-500' },
    atrasada: { label: 'Atrasada', color: 'bg-red-500' },
    cancelada: { label: 'Cancelada', color: 'bg-orange-500' },
};

const statusChartColors = {
    nao_iniciada: '#A0AEC0',
    em_andamento: '#4299E1',
    concluida: '#48BB78',
    atrasada: '#F56565',
    cancelada: '#ED8936',
}

export default function ConsultancyPage() {
    const db = useFirestore();
    const { user, loading: userLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const [actions, setActions] = useState<ConsultancyAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, startSubmitTransition] = useTransition();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [editingAction, setEditingAction] = useState<ConsultancyAction | null>(null);

    const form = useForm<ActionFormValues>({
        resolver: zodResolver(actionSchema),
        defaultValues: {
            acao: '',
            como_sera_realizada: '',
            responsavel: '',
            percentual_concluido: 0,
            status: 'nao_iniciada',
            observacoes: '',
        },
    });

    useEffect(() => {
        if (userLoading) return;
        if (!user) { router.push('/login'); return; }
        if (!db) { setIsLoading(false); return; }

        const q = query(collection(db, ACTIONS_COLLECTION), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const actionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                data_inicio: (doc.data().data_inicio as any).toDate(),
                data_termino: (doc.data().data_termino as any).toDate(),
                prazo_realizado: doc.data().prazo_realizado ? (doc.data().prazo_realizado as any).toDate() : null,
                createdAt: (doc.data().createdAt as any).toDate(),
            } as ConsultancyAction));
            setActions(actionsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user, userLoading, router]);

    const onSubmit = (data: ActionFormValues) => {
        if (!db) return;

        startSubmitTransition(async () => {
            try {
                const actionData = {
                    ...data,
                    percentual_planejado: calculatePlannedProgress(data.data_inicio, data.data_termino),
                };

                if (editingAction) {
                    // Update
                    const docRef = doc(db, ACTIONS_COLLECTION, editingAction.id);
                    await updateDoc(docRef, actionData);
                    toast({ title: "Ação atualizada com sucesso!" });
                } else {
                    // Create
                    await addDoc(collection(db, ACTIONS_COLLECTION), {
                        ...actionData,
                        createdAt: serverTimestamp(),
                        prazo_realizado: null,
                    });
                    toast({ title: "Nova ação adicionada!" });
                }
                form.reset();
                setEditingAction(null);
            } catch (error) {
                console.error("Error saving action:", error);
                toast({ title: "Erro ao salvar ação", variant: "destructive" });
            }
        });
    };
    
    const handleDelete = (actionId: string) => {
        if (!db) return;
        startDeleteTransition(async () => {
            try {
                await deleteDoc(doc(db, ACTIONS_COLLECTION, actionId));
                toast({ title: "Ação excluída com sucesso!" });
            } catch (error) {
                console.error("Error deleting action:", error);
                toast({ title: "Erro ao excluir ação", variant: "destructive" });
            }
        });
    };
    
    const handleEdit = (action: ConsultancyAction) => {
        setEditingAction(action);
        form.reset({
            acao: action.acao,
            como_sera_realizada: action.como_sera_realizada,
            responsavel: action.responsavel,
            data_inicio: action.data_inicio as Date,
            data_termino: action.data_termino as Date,
            percentual_concluido: action.percentual_concluido,
            status: action.status,
            observacoes: action.observacoes,
        });
    };

    const calculatePlannedProgress = (start: Date, end: Date) => {
        const today = new Date();
        if (today < start) return 0;
        if (today > end) return 100;
        const totalDuration = end.getTime() - start.getTime();
        const elapsedDuration = today.getTime() - start.getTime();
        return Math.min(100, Math.round((elapsedDuration / totalDuration) * 100));
    };

    const chartData = useMemo(() => {
        const statusCounts = actions.reduce((acc, action) => {
            acc[action.status] = (acc[action.status] || 0) + 1;
            return acc;
        }, {} as Record<ConsultancyAction['status'], number>);
        
        return Object.entries(statusCounts).map(([name, value]) => ({
            name: statusConfig[name as ConsultancyAction['status']].label,
            value,
            fill: statusChartColors[name as ConsultancyAction['status']],
        }));
    }, [actions]);

    const performanceData = useMemo(() => {
        return actions.map(action => ({
            name: action.acao.substring(0, 15) + '...',
            concluido: action.percentual_concluido,
            planejado: calculatePlannedProgress(action.data_inicio as Date, action.data_termino as Date),
        })).reverse();
    }, [actions]);

    if (isLoading || userLoading) {
        return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-primary">Painel da Consultoria</h1>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status das Ações</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {actions.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        ) : <p className="text-sm text-muted-foreground text-center pt-10">Sem dados para exibir.</p>}
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Análise de Desempenho (% Concluído vs. Planejado)</CardTitle>
                         <LineChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         {actions.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={performanceData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="concluido" name="% Concluído" barSize={20} fill="#48BB78" />
                                <Bar dataKey="planejado" name="% Planejado" barSize={20} fill="#A0AEC0" />
                            </ComposedChart>
                        </ResponsiveContainer>
                        ) : <p className="text-sm text-muted-foreground text-center pt-10">Sem dados para exibir.</p>}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{editingAction ? 'Editar Ação' : 'Adicionar Nova Ação'}</CardTitle>
                    <CardDescription>{editingAction ? `Editando a ação: "${editingAction.acao}"` : 'Preencha os detalhes da nova ação do plano.'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="acao" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ação</FormLabel>
                                        <FormControl><Input placeholder="Ex: Implementar novo sistema de ponto" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="responsavel" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Responsável</FormLabel>
                                        <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="como_sera_realizada" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Como será realizada?</FormLabel>
                                    <FormControl><Textarea placeholder="Descreva os passos para realizar a ação" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="data_inicio" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data de Início</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="data_termino" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data de Término</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="percentual_concluido" render={({ field: { value, onChange } }) => (
                                <FormItem>
                                    <FormLabel>% Concluído: {value}%</FormLabel>
                                    <FormControl>
                                        <Slider defaultValue={[value]} value={[value]} onValueChange={vals => onChange(vals[0])} max={100} step={5} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {Object.entries(statusConfig).map(([key, { label }]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="observacoes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Observações</FormLabel>
                                    <FormControl><Textarea placeholder="Adicione notas ou comentários relevantes" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="flex justify-end gap-4">
                                {editingAction && <Button type="button" variant="ghost" onClick={() => { setEditingAction(null); form.reset(); }}>Cancelar Edição</Button>}
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                    {editingAction ? 'Salvar Alterações' : 'Adicionar Ação'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Lista de Ações</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%]">Ação</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>% Concluído</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {actions.length > 0 ? actions.map(action => (
                                <TableRow key={action.id}>
                                    <TableCell className="font-medium">{action.acao}</TableCell>
                                    <TableCell>{action.responsavel}</TableCell>
                                    <TableCell>
                                        {format(action.data_inicio as Date, 'dd/MM/yy')} - {format(action.data_termino as Date, 'dd/MM/yy')}
                                    </TableCell>
                                    <TableCell>{action.percentual_concluido}%</TableCell>
                                    <TableCell>
                                        <span className={cn("px-2 py-1 text-xs rounded-full text-white", statusConfig[action.status].color)}>
                                            {statusConfig[action.status].label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(action)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isDeleting}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Essa ação não pode ser desfeita. Isso excluirá permanentemente a ação.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(action.id)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Nenhuma ação cadastrada ainda.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}