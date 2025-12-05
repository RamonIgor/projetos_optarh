
"use client";

import { useState, useTransition, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useClient, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { type Client } from '@/types/activity';
import { collection, onSnapshot } from 'firebase/firestore';
import { getUserByEmail } from '@/ai/flows/user-management';


// This function creates a secondary, temporary Firebase app instance
// to handle user creation without affecting the current user's session.
const createSecondaryAuth = () => {
    const appName = `secondary-auth-app-${Date.now()}`;
    try {
        return getAuth(initializeApp(firebaseConfig, appName));
    } catch(e) {
        // Fallback for strict mode double-invoking this
        return getAuth(initializeApp(firebaseConfig, `${appName}-fallback`));
    }
};


export function CreateUserForm({ onFinished }: { onFinished: () => void }) {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, startTransition] = useTransition();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            return;
        }

        startTransition(async () => {
            const secondaryAuth = createSecondaryAuth();
            try {
                await createUserWithEmailAndPassword(secondaryAuth, email, password);
                toast({
                    title: "Usuário Criado!",
                    description: `O acesso para ${email} foi criado. O próximo passo é associá-lo a um cliente.`,
                });
                setEmail('');
                setPassword('');
                // onFinished(); // Keep dialog open to facilitate next step
            } catch (error: any) {
                 let errorMessage = "Ocorreu um erro inesperado.";
                 if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Este email já está em uso por outro colaborador.';
                 } else if (error.code === 'auth/weak-password') {
                     errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
                 } else if (error.code === 'auth/invalid-email') {
                     errorMessage = 'O formato do e-mail é inválido.';
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
        <form onSubmit={handleRegister} className="py-4">
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email-create">Email do Colaborador</Label>
                    <Input
                        id="email-create"
                        type="email"
                        placeholder="nome@cliente.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password-create">Senha Provisória</Label>
                    <Input
                        id="password-create"
                        type="password"
                        placeholder="Mínimo de 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                 <p className="text-sm text-muted-foreground">
                    Isto criará um login. O usuário deverá alterar a senha no primeiro acesso. O próximo passo é associá-lo a um cliente.
                </p>
            </div>
            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Fechar</Button>
                <Button type="submit" disabled={isSubmitting || !email || !password}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Cadastrar
                </Button>
            </DialogFooter>
        </form>
    );
}

export function AssociateUserForm({ onFinished }: { onFinished: () => void }) {
    const db = useFirestore();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'client_user' | 'consultant'>('client_user');
    const [selectedClient, setSelectedClient] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, startTransition] = useTransition();

    useEffect(() => {
        if (!db) return;
        setIsLoading(true);
        const clientsQuery = collection(db, 'clients');
        const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(clientsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !email || !role || (role === 'client_user' && !selectedClient)) {
            toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha todos os campos para associar o usuário.' });
            return;
        }

        startTransition(async () => {
            try {
                const { uid } = await getUserByEmail({ email });
                if (!uid) {
                    toast({ variant: 'destructive', title: 'Usuário não encontrado', description: 'Nenhum usuário encontrado com este e-mail.' });
                    return;
                }

                const userDocRef = doc(db, 'users', uid);
                await setDoc(userDocRef, {
                    clientId: role === 'consultant' ? '' : selectedClient,
                    role: role
                });

                toast({ title: 'Usuário associado com sucesso!' });
                setEmail('');
                setRole('client_user');
                setSelectedClient('');
                onFinished();
            } catch (error: any) {
                console.error("Error associating user:", error);
                toast({ variant: 'destructive', title: 'Erro ao associar', description: error.message || 'Não foi possível salvar a associação.' });
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="email-associate">Email do Usuário</Label>
                <Input
                    id="email-associate"
                    type="email"
                    placeholder="Cole o e-mail do usuário aqui"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="role">Cargo</Label>
                <Select value={role} onValueChange={(value) => setRole(value as any)}>
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="client_user">Usuário do Cliente</SelectItem>
                        <SelectItem value="consultant">Consultor(a)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {role === 'client_user' && (
                <div className="grid gap-2">
                    <Label htmlFor="client">Cliente</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient} disabled={isLoading}>
                        <SelectTrigger id="client">
                            <SelectValue placeholder={isLoading ? 'Carregando clientes...' : 'Selecione o cliente'} />
                        </SelectTrigger>
                        <SelectContent>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Associar Usuário
                </Button>
            </DialogFooter>
        </form>
    );
}


export function UserManagementDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Colaboradores</DialogTitle>
                    <DialogDescription>
                        Crie novos usuários ou associe usuários existentes a um cliente.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="create" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="create">Cadastrar Novo</TabsTrigger>
                        <TabsTrigger value="associate">Associar Existente</TabsTrigger>
                    </TabsList>
                    <TabsContent value="create">
                        <CreateUserForm onFinished={() => setOpen(false)} />
                    </TabsContent>
                    <TabsContent value="associate">
                        <AssociateUserForm onFinished={() => setOpen(false)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
