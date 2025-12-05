
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, setDoc, doc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useFirestore as useDb } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Client } from '@/types/activity';

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

function CreateUserForm({ onFinished, clients, isLoadingClients }: { onFinished: () => void, clients: Client[], isLoadingClients: boolean }) {
    const { toast } = useToast();
    const db = useDb();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [isSubmitting, startTransition] = useTransition();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !selectedClientId) {
            toast({ title: "Preencha todos os campos", description: "Email, senha e cliente são obrigatórios.", variant: "destructive"});
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
                    role: 'client_user'
                });

                toast({
                    title: "Usuário Criado e Associado!",
                    description: `${email} foi criado e vinculado ao cliente.`,
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
             <p className="text-sm text-muted-foreground !mt-2">
                O usuário será criado e vinculado. Deverá alterar a senha no primeiro acesso.
            </p>
            <DialogFooter className="!mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Fechar</Button>
                <Button type="submit" disabled={isSubmitting || !email || !password || !selectedClientId}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Criar e Associar
                </Button>
            </DialogFooter>
        </form>
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Colaboradores</DialogTitle>
                    <DialogDescription>
                        Crie novas contas para colaboradores e vincule-as a um cliente.
                    </DialogDescription>
                </DialogHeader>

                <CreateUserForm onFinished={() => setOpen(false)} clients={clients} isLoadingClients={isLoadingClients} />

            </DialogContent>
        </Dialog>
    );
}
