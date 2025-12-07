
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, RefreshCw } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, setDoc, doc, collection, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useFirestore as useDb } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { type Client } from '@/types/activity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from './ui/scroll-area';

// This function creates a secondary, temporary Firebase app instance
// to handle user creation without affecting the current user's session.
const createSecondaryAuth = () => {
    const appName = `secondary-auth-app-${Date.now()}`;
    try {
        const secondaryApp = initializeApp(firebaseConfig, appName);
        return getAuth(secondaryApp);
    } catch(e) {
        // Fallback for strict mode double-invoking this
        const secondaryApp = initializeApp(firebaseConfig, `${appName}-fallback`);
         return getAuth(secondaryApp);
    }
};

const productsAvailable = [
    { id: 'process_flow', label: 'ProcessFlow' },
    { id: 'pesquisa_clima', label: 'Pesquisa de Clima' },
]

function CreateUserForm({ onFinished, clients, isLoadingClients }: { onFinished: () => void, clients: Client[], isLoadingClients: boolean }) {
    const { toast } = useToast();
    const db = useDb();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>(['process_flow']);
    const [isSubmitting, startTransition] = useTransition();

    const handleProductChange = (productId: string, checked: boolean) => {
        setSelectedProducts(prev => 
            checked ? [...prev, productId] : prev.filter(id => id !== productId)
        );
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !selectedClientId || selectedProducts.length === 0) {
            toast({ title: "Preencha todos os campos", description: "Email, senha, cliente e ao menos um produto são obrigatórios.", variant: "destructive"});
            return;
        }

        startTransition(async () => {
            const secondaryAuth = createSecondaryAuth();
            try {
                // 1. Create user in Auth using the secondary instance
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const newUser = userCredential.user;

                // 2. Create user profile in Firestore using the primary, authenticated instance
                // This ensures the write operation is performed by the logged-in consultant
                await setDoc(doc(db, "users", newUser.uid), {
                    clientId: selectedClientId,
                    products: selectedProducts,
                    isConsultant: false,
                    email: newUser.email, // Save the email
                });

                toast({
                    title: "Usuário Criado e Associado!",
                    description: `${email} foi criado e vinculado ao cliente com os produtos selecionados.`,
                });
                
                onFinished();

            } catch (error: any) {
                 let errorMessage = "Ocorreu um erro inesperado.";
                 if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Este email já está em uso por outro colaborador.';
                 } else if (error.code === 'auth/weak-password') {
                     errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
                 } else if (error.code === 'auth/invalid-email') {
                     errorMessage = 'O formato do e-mail é inválido.';
                 } else {
                     console.error("Unexpected registration error:", error);
                 }
                 toast({
                    variant: "destructive",
                    title: "Erro ao Cadastrar",
                    description: errorMessage,
                });
            }
        });
    };

    return (
        <form onSubmit={handleRegister} className="py-4 space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="email-create">Email do Colaborador</Label>
                <Input id="email-create" type="email" placeholder="nome@cliente.com.br" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="password-create">Senha Provisória</Label>
                <Input id="password-create" type="password" placeholder="Mínimo de 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="client-select-create">Associar ao Cliente</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                     <SelectTrigger id="client-select-create" disabled={isLoadingClients}>
                        <SelectValue placeholder={isLoadingClients ? "Carregando clientes..." : "Selecione um cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                        {isLoadingClients ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
                        ) : clients.length > 0 ? (
                            clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                            ))
                        ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum cliente cadastrado.</div>
                        )}
                    </SelectContent>
                </Select>
            </div>
             <div className="grid gap-2">
                <Label>Produtos Acessíveis</Label>
                <div className="space-y-2 rounded-md border p-2">
                    {productsAvailable.map(product => (
                         <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`product-${product.id}`}
                                checked={selectedProducts.includes(product.id)}
                                onCheckedChange={(checked) => handleProductChange(product.id, !!checked)}
                            />
                            <Label htmlFor={`product-${product.id}`} className="font-normal cursor-pointer">
                                {product.label}
                            </Label>
                        </div>
                    ))}
                </div>
            </div>
             <p className="text-sm text-muted-foreground !mt-2">
                O usuário deverá alterar a senha no primeiro acesso.
            </p>
            <DialogFooter className="!mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Fechar</Button>
                <Button type="submit" disabled={isSubmitting || !email || !password || !selectedClientId || selectedProducts.length === 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Criar e Associar
                </Button>
            </DialogFooter>
        </form>
    );
}

interface LegacyUser {
    id: string;
    clientId: string;
    email?: string; // Add email field
    isConsultant: boolean;
}

function MigrateUsersForm({ onFinished }: { onFinished: () => void }) {
    const db = useDb();
    const { toast } = useToast();
    const [legacyUsers, setLegacyUsers] = useState<LegacyUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState<string | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<Record<string, string[]>>({});

    const fetchLegacyUsers = async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            const usersQuery = query(collection(db, 'users'));
            const snapshot = await getDocs(usersQuery);
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (LegacyUser & { products?: any[] })[];
            const filteredUsers = allUsers.filter(user => !user.hasOwnProperty('products'));
            setLegacyUsers(filteredUsers);
        } catch (error) {
            console.error("Error fetching legacy users:", error);
            toast({ title: "Erro ao buscar usuários antigos", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchLegacyUsers();
    }, [db]);

    const handleProductChange = (userId: string, productId: string, checked: boolean) => {
        setSelectedProducts(prev => {
            const userProducts = prev[userId] || [];
            const newUserProducts = checked 
                ? [...userProducts, productId] 
                : userProducts.filter(id => id !== productId);
            return { ...prev, [userId]: newUserProducts };
        });
    };

    const handleMigrateUser = async (userId: string) => {
        if (!db || !selectedProducts[userId] || selectedProducts[userId].length === 0) {
            toast({ title: "Selecione ao menos um produto", variant: "destructive" });
            return;
        }
        setIsMigrating(userId);
        try {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, {
                products: selectedProducts[userId]
            });
            toast({ title: "Usuário atualizado com sucesso!" });
            // Refetch users to remove the migrated one from the list
            fetchLegacyUsers();
        } catch (error) {
             console.error("Error migrating user:", error);
             toast({ title: "Erro ao migrar usuário", variant: "destructive" });
        } finally {
            setIsMigrating(null);
        }
    }


    return (
        <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
                A lista abaixo mostra usuários criados antes da atualização de multi-produtos. Atualize-os para garantir o acesso correto.
            </p>
            <ScrollArea className="h-72 border rounded-md">
                 <div className="p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : legacyUsers.length > 0 ? (
                    legacyUsers.map(user => (
                        <div key={user.id} className="p-3 border rounded-lg">
                            <p className="font-semibold text-sm truncate" title={user.email || user.id}>{user.email || user.id}</p>
                            <p className="text-xs text-muted-foreground">Cliente ID: {user.clientId}</p>
                            <div className="my-2 space-y-1">
                                {productsAvailable.map(product => (
                                    <div key={product.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`migrate-${user.id}-${product.id}`}
                                            checked={selectedProducts[user.id]?.includes(product.id) || false}
                                            onCheckedChange={(checked) => handleProductChange(user.id, product.id, !!checked)}
                                        />
                                        <Label htmlFor={`migrate-${user.id}-${product.id}`} className="font-normal text-sm">{product.label}</Label>
                                    </div>
                                ))}
                            </div>
                            <Button 
                                size="sm" 
                                className="w-full mt-2" 
                                disabled={isMigrating === user.id || !selectedProducts[user.id]?.length}
                                onClick={() => handleMigrateUser(user.id)}
                            >
                                {isMigrating === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Atualizar Usuário
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">Nenhum usuário antigo encontrado.</p>
                    </div>
                )}
                 </div>
            </ScrollArea>
             <DialogFooter className="!mt-6">
                <Button variant="outline" onClick={onFinished}>Fechar</Button>
            </DialogFooter>
        </div>
    );
}

export function UserManagementDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const db = useDb();
    const { toast } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(true);

    useEffect(() => {
        if (!db || !open) return;
        setIsLoadingClients(true);
        const fetchClients = async () => {
            try {
                const clientsQuery = query(collection(db, 'clients'), orderBy('name', 'asc'));
                const snapshot = await getDocs(clientsQuery);
                const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(clientsData);
            } catch (error) {
                console.error("Error fetching clients:", error);
                toast({ title: "Erro ao buscar clientes", variant: "destructive" });
            } finally {
                setIsLoadingClients(false);
            }
        };
        fetchClients();
    }, [db, toast, open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Gerenciar Colaboradores</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="create">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="create">Criar Novo</TabsTrigger>
                        <TabsTrigger value="migrate">Migrar Antigos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="create">
                         <CreateUserForm onFinished={() => setOpen(false)} clients={clients} isLoadingClients={isLoadingClients} />
                    </TabsContent>
                    <TabsContent value="migrate">
                        <MigrateUsersForm onFinished={() => setOpen(false)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
