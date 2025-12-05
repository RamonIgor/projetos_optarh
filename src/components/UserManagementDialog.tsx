
"use client";

import { useState, useTransition } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useClient, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApp, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';


// This function creates a secondary, temporary Firebase app instance
// to handle user creation without affecting the current user's session.
const createSecondaryAuth = () => {
    const appName = `secondary-auth-app-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    return getAuth(secondaryApp);
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
                    description: `O acesso para ${email} foi criado. Use a aba 'Associar Existente' para definir o cargo.`,
                });
                setEmail('');
                setPassword('');
                onFinished();
            } catch (error: any) {
                 let errorMessage = "Ocorreu um erro inesperado.";
                 if (error.code === 'auth/email-already-exists') {
                    errorMessage = 'Este email já está em uso por outro colaborador.';
                 } else if (error.code === 'auth/invalid-password') {
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
                    Isto apenas criará o login no sistema de autenticação. Use a aba 'Associar Existente' para definir as permissões e o cliente.
                </p>
            </div>
            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Cancelar</Button>
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
    const auth = useAuth();
    const { selectedClientId } = useClient();
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'client_user' | 'consultant'>('client_user');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssociate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !auth || !email) {
            toast({
                title: "Erro de configuração",
                description: "Preencha o e-mail para associar um usuário.",
                variant: "destructive",
            });
            return;
        }
        if (role === 'client_user' && !selectedClientId) {
             toast({
                title: "Erro de configuração",
                description: "Selecione um cliente no Painel da Consultoria antes de associar um usuário do tipo 'Cliente'.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        // This part needs a secure way to get user by email. Since we can't use Admin SDK reliably,
        // we'll assume for now the user must be associated manually if UID is not known.
        // For a full production app, a cloud function would be required.
        // For this context, we will simply show a message.
        
        toast({
            title: "Associação Manual Necessária",
            description: "A associação de um usuário existente a um cargo precisa ser feita diretamente no console do Firebase para garantir a segurança.",
            variant: "default",
        });

        // The code below would require an admin privilege that is not available client-side without security risks.
        /*
        try {
            // This function does not exist on client-side SDK:
            // const userRecord = await auth.getUserByEmail(email); 
            // const uid = userRecord.uid;
            
            // Placeholder: Manually get UID and uncomment
            const uid = "MANUAL_UID_HERE";

            if (!uid || uid === "MANUAL_UID_HERE") {
                 toast({
                    title: "Ação Manual Necessária",
                    description: "Para associar um usuário, você precisa obter o UID dele no console do Firebase e inseri-lo no código.",
                    variant: "destructive",
                });
                setIsSubmitting(false);
                return;
            }
            
            const userDocRef = doc(db, "users", uid);
            await setDoc(userDocRef, {
                clientId: role === 'consultant' ? null : selectedClientId,
                role: role
            }, { merge: true });

            toast({
                title: "Usuário Associado!",
                description: `${email} foi associado com o cargo de ${role === 'consultant' ? 'Consultor' : 'Usuário do Cliente'}.`,
            });
            
            setEmail('');
            onFinished();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao associar usuário",
                description: "Não foi possível encontrar o usuário. Verifique se o e-mail está correto e se o usuário já existe no sistema de autenticação.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
        */
       setIsSubmitting(false);
       onFinished();
    };

    return (
        <form onSubmit={handleAssociate} className="py-4">
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email-associate">Email do Usuário</Label>
                    <Input
                        id="email-associate"
                        type="email"
                        placeholder="usuario@existente.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="role-associate">Cargo</Label>
                     <Select value={role} onValueChange={(value) => setRole(value as any)}>
                        <SelectTrigger id="role-associate">
                            <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="client_user">Usuário do Cliente</SelectItem>
                            <SelectItem value="consultant">Consultor</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <p className="text-sm text-muted-foreground">
                    Devido a limitações de segurança, a associação de um usuário já existente deve ser feita no console do Firebase. Esta função está desabilitada temporariamente.
                </p>
            </div>
            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || !email}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                    )}
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
