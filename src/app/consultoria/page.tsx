
"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth, useFirestore, useClient } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type ConsultancyAction, type Activity, type Client } from '@/types/activity';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, CalendarIcon, Trash2, Edit, BarChart, LineChart, FileText, CheckSquare, PieChart as PieChartIcon, Shuffle, Clock, Building, Wrench, LogOut, ArrowLeft, Settings, UserPlus, KeyRound, Workflow, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Bar, XAxis, YAxis, CartesianGrid, ComposedChart } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import dynamic from 'next/dynamic';
import type { CategoryChartData } from '@/components/CategoryChart';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserManagementDialog } from '@/components/UserManagementDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { signOut } from 'firebase/auth';

const CategoryChart = dynamic(() => import('@/components/CategoryChart'), {
    ssr: false,
    loading: () => <div className="h-[250px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
});

const newClientSchema = z.object({
  name: z.string().min(2, "O nome do cliente é obrigatório."),
});
type NewClientFormValues = z.infer<typeof newClientSchema>;


const productsAvailable = [
    { id: 'process_flow', label: 'ProcessFlow', icon: Workflow },
    { id: 'pulse_check', label: 'PulseCheck', icon: BarChart2 },
]

function ClientSettingsDialog({ client, onFinished }: { client: Client | null, onFinished: () => void }) {
    const db = useFirestore();
    const { toast } = useToast();
    const [isSaving, startSaving] = useTransition();
    const [open, setOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    useEffect(() => {
        if (client) {
            setSelectedProducts(client.products || []);
        }
    }, [client]);

    const handleProductChange = (productId: string, checked: boolean) => {
        setSelectedProducts(prev =>
            checked ? [...prev, productId] : prev.filter(id => id !== productId)
        );
    };

    const handleSave = () => {
        if (!db || !client) return;
        startSaving(async () => {
            try {
                const clientRef = doc(db, 'clients', client.id);
                await updateDoc(clientRef, {
                    products: selectedProducts,
                });
                toast({ title: "Produtos do cliente atualizados!" });
                onFinished();
                setOpen(false);
            } catch (error) {
                console.error("Error updating client products:", error);
                toast({ title: "Erro ao salvar", variant: "destructive" });
            }
        });
    };

    if (!client) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" disabled={!client}>
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Configurações do Cliente</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gerenciar Produtos do Cliente</DialogTitle>
                    <DialogDescription>
                        Habilite ou desabilite o acesso aos produtos para <strong>{client.name}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Label>Produtos Contratados</Label>
                    <div className="space-y-3 rounded-md border p-4">
                        {productsAvailable.map(product => (
                            <div key={product.id} className="flex items-center space-x-3">
                                <Checkbox
                                    id={`client-product-${product.id}`}
                                    checked={selectedProducts.includes(product.id)}
                                    onCheckedChange={(checked) => handleProductChange(product.id, !!checked)}
                                />
                                <product.icon className="h-5 w-5 text-muted-foreground" />
                                <Label htmlFor={`client-product-${product.id}`} className="font-normal cursor-pointer">
                                    {product.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddClientDialog({ onClientAdded, children }: { onClientAdded: (clientId: string) => void, children: React.ReactNode }) {
    const db = useFirestore();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [isSubmitting, startSubmitTransition] = useTransition();

    const form = useForm<NewClientFormValues>({
        resolver: zodResolver(newClientSchema),
        defaultValues: { name: '' },
    });

    const onSubmit = (data: NewClientFormValues) => {
        if (!db) return;
        startSubmitTransition(async () => {
            try {
                const docRef = await addDoc(collection(db, 'clients'), {
                    name: data.name,
                    userIds: [],
                    products: [], // Initialize with no products
                    createdAt: serverTimestamp(),
                });
                toast({ title: "Cliente adicionado com sucesso!" });
                form.reset();
                setOpen(false);
                onClientAdded(docRef.id);
            } catch (error) {
                console.error("Error adding client:", error);
                toast({ title: "Erro ao adicionar cliente", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                    <DialogDescription>Crie um novo cliente para começar a gerenciar as atividades.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nome do Cliente</FormLabel>
                                <FormControl><Input placeholder="Ex: Empresa Exemplo S/A" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Adicionar Cliente
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const actionSchema = z.object({
  acao: z.string().min(3, "A ação deve ter pelo menos 3 caracteres."),
  como_sera_realizada: z.string().optional(),
  responsavel: z.string().min(2, "O responsável é obrigatório."),
  data_inicio: z.date({ required_error: "A data de início é obrigatória." }),
  data_termino: z.date({ required_error: "A data de término é obrigatória." }),
  percentual_concluido: z.number().min(0).max(100),
  status: z.enum(["nao_iniciada", "em_andamento", "concluida", "atrasada", "cancelada"]),
  observacoes: z.string().optional(),
}).refine(data => {
    if (data.status === 'concluida' && data.percentual_concluido !== 100) {
        return false;
    }
    return true;
}, {
    message: "O percentual concluído deve ser 100% para o status 'Concluída'.",
    path: ['status'],
});

type ActionFormValues = z.infer<typeof actionSchema>;

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

function ActionForm({ action, onFinished, clientId }: { action?: ConsultancyAction | null, onFinished: () => void, clientId: string }) {
    const db = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, startSubmitTransition] = useTransition();

    const form = useForm<ActionFormValues>({
        resolver: zodResolver(actionSchema),
        defaultValues: {
            acao: action?.acao || '',
            como_sera_realizada: action?.como_sera_realizada || '',
            responsavel: action?.responsavel || '',
            data_inicio: action?.data_inicio ? new Date(action.data_inicio as any) : undefined,
            data_termino: action?.data_termino ? new Date(action.data_termino as any) : undefined,
            percentual_concluido: action?.percentual_concluido || 0,
            status: action?.status || 'nao_iniciada',
            observacoes: action?.observacoes || '',
        },
    });
    
    const status = form.watch('status');
    useEffect(() => {
        if (status === 'concluida') {
            form.setValue('percentual_concluido', 100);
        }
    }, [status, form]);


    const onSubmit = (data: ActionFormValues) => {
        if (!db) return;
        
        const actionsCollectionPath = `clients/${clientId}/actions`;

        startSubmitTransition(async () => {
            try {
                const actionData = {
                    ...data,
                    percentual_planejado: 0, // Deprecated, but keeping for schema compatibility
                };

                if (action) {
                    const docRef = doc(db, actionsCollectionPath, action.id);
                    await updateDoc(docRef, actionData)
                    .catch(async () => {
                        const permissionError = new FirestorePermissionError({
                            path: docRef.path,
                            operation: 'update',
                            requestResourceData: actionData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                        toast({ title: "Erro de Permissão ao Atualizar", description: "Você não tem permissão para editar esta ação.", variant: "destructive" });
                    });
                    toast({ title: "Ação atualizada com sucesso!" });
                } else {
                     await addDoc(collection(db, actionsCollectionPath), {
                        ...actionData,
                        createdAt: serverTimestamp(),
                        prazo_realizado: null,
                    }).catch(async () => {
                         const permissionError = new FirestorePermissionError({
                            path: collection(db, actionsCollectionPath).path,
                            operation: 'create',
                            requestResourceData: actionData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                        toast({ title: "Erro de Permissão ao Adicionar", description: "Você não tem permissão para adicionar novas ações.", variant: "destructive" });
                    });
                    toast({ title: "Nova ação adicionada!" });
                }
                form.reset();
                onFinished();
            } catch (error) {
                console.error("Error saving action:", error);
                toast({ title: "Erro ao salvar ação", variant: "destructive" });
            }
        });
    };
    
    return (
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
                        <Select 
                            onValueChange={field.onChange}
                            defaultValue={field.value} 
                            value={field.value}
                        >
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

                <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={onFinished}>Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        {action ? 'Salvar Alterações' : 'Adicionar Ação'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

const StatCard = ({ title, value, icon, children, className }: { title: string, value: string | number, icon: React.ReactNode, children?: React.ReactNode, className?: string }) => (
    <Card className={cn("shadow-lg", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <div className={cn("h-6 w-6")}>{icon}</div>
        </CardHeader>
        <CardContent>
            <div className="text-4xl font-bold">{value}</div>
            {children}
        </CardContent>
    </Card>
);

function ClientSelector({ clients, onClientAdded }: { clients: Client[], onClientAdded: (id: string) => void }) {
    const { selectedClientId, setSelectedClientId } = useClient();
    const selectedClient = clients.find(c => c.id === selectedClientId);

    if (clients.length === 0) {
        return (
            <AddClientDialog onClientAdded={onClientAdded}>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Primeiro Cliente
                </Button>
            </AddClientDialog>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                    {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <ClientSettingsDialog client={selectedClient} onFinished={() => {}} />
            <AddClientDialog onClientAdded={onClientAdded}>
                 <Button variant="outline" size="icon">
                    <PlusCircle className="h-4 w-4" />
                    <span className="sr-only">Adicionar Novo Cliente</span>
                </Button>
            </AddClientDialog>
        </div>
    );
}

export default function ConsultancyPage() {
    const db = useFirestore();
    const auth = useAuth();
    const { user, loading: userLoading } = useUser();
    const { isConsultant, isClientLoading, setSelectedClientId, selectedClientId } = useClient();
    const router = useRouter();
    const { toast } = useToast();

    const [allClients, setAllClients] = useState<Client[]>([]);
    
    const [actions, setActions] = useState<ConsultancyAction[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isLoadingClients, setIsLoadingClients] = useState(true);
    const [isDeleting, startDeleteTransition] = useTransition();
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAction, setEditingAction] = useState<ConsultancyAction | null>(null);

    const handleLogout = async () => {
        if (!auth) return;
        await signOut(auth);
        router.push('/login');
    };

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login');
        } else if (!userLoading && user && !isConsultant) {
            router.push('/');
        }
    }, [user, userLoading, router, isConsultant]);

    // Effect to fetch the list of clients for consultants
    useEffect(() => {
        if (!isConsultant || !db || !user) {
            setIsLoadingClients(false);
            return;
        }

        setIsLoadingClients(true);
        const clientsQuery = query(collection(db, 'clients'), orderBy('name', 'asc'));
        const unsubClients = onSnapshot(clientsQuery, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setAllClients(clientsData);
            setIsLoadingClients(false);
        }, (err) => {
            console.error("Error fetching clients:", err);
            setIsLoadingClients(false);
        });

        return () => unsubClients();
    }, [db, isConsultant, user]);

    const handleClientAdded = useCallback((newClientId: string) => {
        setSelectedClientId(newClientId);
    }, [setSelectedClientId]);
    
    // Data fetching for the selected client
    useEffect(() => {
        if (!selectedClientId || !db || !user) {
            setActions([]);
            setActivities([]);
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        let activeSubscriptions = 2;
        const onSubscriptionLoaded = () => {
            activeSubscriptions--;
            if(activeSubscriptions === 0) setIsLoadingData(false);
        }

        const actionsCollectionRef = collection(db, 'clients', selectedClientId, 'actions');
        const qActions = query(actionsCollectionRef, orderBy("createdAt", "asc"));
        const unsubActions = onSnapshot(qActions, 
            (snapshot) => {
                const actionsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    data_inicio: doc.data().data_inicio?.toDate(),
                    data_termino: doc.data().data_termino?.toDate(),
                    prazo_realizado: doc.data().prazo_realizado ? (doc.data().prazo_realizado as any).toDate() : null,
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                } as ConsultancyAction));
                setActions(actionsData);
                onSubscriptionLoaded();
            },
            (error) => {
                console.error("Error fetching consultancy actions:", error);
                const permissionError = new FirestorePermissionError({
                    path: actionsCollectionRef.path,
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                onSubscriptionLoaded();
                toast({
                    title: "Erro de Permissão",
                    description: "Você não tem permissão para visualizar estas ações.",
                    variant: "destructive"
                });
            }
        );
        
        const activitiesCollectionRef = collection(db, 'clients', selectedClientId, 'activities');
        const qActivities = query(activitiesCollectionRef, orderBy("createdAt", "desc"));
        const unsubActivities = onSnapshot(qActivities, 
            (snapshot) => {
                const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
                setActivities(activitiesData);
                onSubscriptionLoaded();
            },
            (error) => {
                console.error("Error fetching client activities:", error);
                onSubscriptionLoaded();
            }
        );

        return () => {
          unsubActions();
          unsubActivities();
        }
    }, [db, selectedClientId, toast, user]);

    const handleDelete = (actionId: string) => {
        if (!db || !selectedClientId) return;
        startDeleteTransition(async () => {
            try {
                const docRef = doc(db, 'clients', selectedClientId, 'actions', actionId);
                await deleteDoc(docRef).catch(() => {
                     const permissionError = new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'delete',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    toast({ title: "Erro de Permissão ao Excluir", description: "Você não tem permissão para excluir esta ação.", variant: "destructive" });
                });
                toast({ title: "Ação excluída com sucesso!" });
            } catch (error) {
                console.error("Error deleting action:", error);
                toast({ title: "Erro ao excluir ação", variant: "destructive" });
            }
        });
    };
    
    const handleEdit = (action: ConsultancyAction) => {
        setEditingAction(action);
        setDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingAction(null);
        setDialogOpen(true);
    };
    
    const onFormFinished = () => {
        setDialogOpen(false);
        setEditingAction(null);
    }

    const actionChartData = useMemo(() => {
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

    const actionPerformanceData = useMemo(() => {
        return actions.map(action => ({
            name: action.acao.substring(0, 15) + '...',
            concluido: action.percentual_concluido,
            meta: 100,
        }));
    }, [actions]);

    const clientStats = useMemo(() => {
        const total = activities.length;
        const classified = activities.filter(a => a.status !== 'brainstorm').length;
        const approved = activities.filter(a => a.status === 'aprovada').length;
        const byCategory = activities.reduce((acc, a) => {
            if (a.categoria) acc[a.categoria] = (acc[a.categoria] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byStatus = activities.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byTransitionStatus = activities.reduce((acc, a) => {
            acc[a.statusTransicao] = (acc[a.statusTransicao] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return { total, classified, approved, byCategory, byStatus, byTransitionStatus };
    }, [activities]);
    
    const clientCategoryChartData = useMemo(() => [
        { name: 'DP', value: clientStats.byCategory['DP'] || 0, fill: 'hsl(var(--primary))' },
        { name: 'RH', value: clientStats.byCategory['RH'] || 0, fill: '#16a34a' },
        { name: 'Compartilhado', value: clientStats.byCategory['Compartilhado'] || 0, fill: '#2563eb' }
    ].filter(item => item.value > 0), [clientStats.byCategory]);

    const renderClientSelector = () => {
        if (isLoadingClients) {
            return <div className="flex items-center justify-center w-[280px] h-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
        }
        return <ClientSelector clients={allClients} onClientAdded={handleClientAdded} />;
    };

    const isLoadingPage = userLoading || isClientLoading;

    if (isLoadingPage && !isConsultant) {
        return (
            <div className="flex justify-center items-center h-screen w-full"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Image src="/optarh-logo.png" alt="OptaRH Logo" width={120} height={40} unoptimized />
                     <Button variant="outline" size="icon" onClick={() => router.push('/')}>
                        <ArrowLeft className="h-4 w-4" />
                     </Button>
                </div>
                 <div>
                    <h1 className="text-2xl sm:text-4xl font-bold text-primary text-center sm:text-left">Painel da Consultoria</h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Settings className="h-5 w-5" />
                                <span className="sr-only">Configurações</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isConsultant && (
                                <UserManagementDialog>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        <span>Gerenciar Colaboradores</span>
                                    </DropdownMenuItem>
                                </UserManagementDialog>
                            )}
                            <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => router.push('/change-password')}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Alterar senha
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full sm:w-auto">
                    {isConsultant && renderClientSelector()}
                </div>
                 <div className="w-full sm:w-auto">
                    <Button onClick={handleAddNew} disabled={!selectedClientId} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Ação ao Plano
                    </Button>
                 </div>
            </div>

             <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh]">
                        <DialogHeader>
                        <DialogTitle>{editingAction ? 'Editar Ação' : 'Adicionar Nova Ação'}</DialogTitle>
                        <DialogDescription>{editingAction ? `Editando a ação: "${editingAction.acao}"` : 'Preencha os detalhes da nova ação do plano.'}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-6 -mr-6">
                        <div className="pr-1">
                        {selectedClientId && <ActionForm action={editingAction} onFinished={onFormFinished} clientId={selectedClientId} />}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        
            {!selectedClientId && isConsultant ? (
                    <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <Building className="h-8 w-8 text-muted-foreground" />
                            Selecione um cliente
                        </CardTitle>
                        <CardDescription>
                            Escolha um cliente na lista acima para ver o painel de ações e o resumo das atividades.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingClients ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                            allClients.length === 0 && (
                                <p className="text-muted-foreground">Nenhum cliente cadastrado. Adicione o primeiro para começar.</p>
                            )
                        )}
                    </CardContent>
                    </Card>
            ) : isLoadingData ? (
                <div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : (
            <>
                <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Visão Geral do Cliente</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Progresso do Levantamento" value={clientStats.total} icon={<FileText />}>
                        <p className="text-xs text-muted-foreground mt-2">
                            {clientStats.classified} classificadas, {clientStats.approved} aprovadas.
                        </p>
                        <Progress value={(clientStats.approved / (clientStats.total || 1)) * 100} className="mt-2 h-2" />
                    </StatCard>
                        <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-md font-medium text-muted-foreground flex items-center gap-2"><PieChartIcon className="h-5 w-5" />Divisão por Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {clientCategoryChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={150}>
                                    <PieChart>
                                        <Pie 
                                            data={clientCategoryChartData} 
                                            dataKey="value" 
                                            nameKey="name" 
                                            cx="50%" 
                                            cy="45%" 
                                            outerRadius={50} 
                                            labelLine={false} 
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return value > 0 ? (
                                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                                        {value}
                                                    </text>
                                                ) : null;
                                            }}>
                                            {clientCategoryChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend iconSize={10} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <p className="text-center text-sm text-muted-foreground py-10">Nenhuma atividade categorizada</p>}
                        </CardContent>
                    </Card>
                    <StatCard title="Status de Aprovação" value={clientStats.approved} icon={<CheckSquare />} className="text-green-500">
                        <p className="text-xs text-muted-foreground mt-2">
                            <span className="text-yellow-500">{clientStats.byStatus['aguardando_consenso'] || 0} aguardando</span>, {' '}
                            <span className="text-gray-500">{clientStats.byStatus['brainstorm'] || 0} não classificadas</span>
                        </p>
                    </StatCard>
                    <StatCard title="Progresso da Transição" value={`${clientStats.byTransitionStatus['em_transicao'] || 0}`} icon={<Shuffle />}>
                            <p className="text-xs text-muted-foreground mt-2">
                            <span className="text-green-500">{clientStats.byTransitionStatus['concluida'] || 0} concluídas</span>, {' '}
                            <span className="text-gray-500">{clientStats.byTransitionStatus['a_transferir'] || 0} aguardando</span>
                        </p>
                    </StatCard>
                </CardContent>
            </Card>

                <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Plano de Ação da Consultoria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Status das Ações</CardTitle>
                                <BarChart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {actions.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={actionChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                    {value}
                                                </text>
                                            );
                                        }}>
                                            {actionChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                                ) : <p className="text-sm text-muted-foreground text-center pt-10">Sem dados para exibir.</p>}
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-2">
                            <CardHeader className='pb-2'>
                                <CardTitle className="text-sm font-medium flex items-center justify-between">
                                    <span>Análise de Desempenho (% Concluído)</span>
                                    <LineChart className="h-4 w-4 text-muted-foreground" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {actions.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <ComposedChart data={actionPerformanceData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="concluido" name="% Concluído" barSize={20} fill="#48BB78" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                                ) : <p className="text-sm text-muted-foreground text-center pt-10">Sem dados para exibir.</p>}
                            </CardContent>
                        </Card>
                    </div>
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
                </>
            )}
        </div>
    );
}
