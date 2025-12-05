
"use client";

import { useState, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, type AuthError } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getUserByEmail } from '@/ai/flows/user-management';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


export const UserManagementDialog: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Colaboradores</DialogTitle>
                    <DialogDescription>
                        Crie novas contas ou associe usuários existentes ao cliente selecionado no seu painel.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="create">
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

function CreateUserForm({ onFinished }: { onFinished: () => void }) {
    const auth = useAuth();
    const db = useFirestore();
    const { selectedClientId } = useClient();
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAuthError = (error: AuthError) => {
        let title = "Erro ao Cadastrar";
        let description = "Ocorreu um erro inesperado. Tente novamente.";
        
        switch (error.code) {
            case 'auth/invalid-email':
                title = "Email Inválido";
                description = "Por favor, insira um endereço de email válido.";
                break;
            case 'auth/email-already-in-use':
                title = "Email já cadastrado";
                description = "Este email já está em uso por outro colaborador.";
                break;
            case 'auth/weak-password':
                title = "Senha Fraca";
                description = "A senha deve ter pelo menos 6 caracteres.";
                break;
            default:
                console.error("Registration error:", error);
        }

        toast({
            variant: "destructive",
            title: title,
            description: description,
        });
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth || !db || !selectedClientId || !email || !password) {
            toast({
                title: "Erro de configuração",
                description: "Selecione um cliente no Painel da Consultoria antes de cadastrar um colaborador.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                clientId: selectedClientId,
                role: 'client_user'
            });

            toast({
                title: "Colaborador Cadastrado!",
                description: `O acesso para ${email} foi criado com sucesso.`,
            });
            
            setEmail('');
            setPassword('');
            onFinished();
        } catch (error) {
            handleAuthError(error as AuthError);
        } finally {
            setIsSubmitting(false);
        }
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
            </div>
            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || !email || !password || !selectedClientId}>
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

function AssociateUserForm({ onFinished }: { onFinished: () => void }) {
    const db = useFirestore();
    const { selectedClientId } = useClient();
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'client_user' | 'consultant'>('client_user');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssociate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !selectedClientId || !email) {
            toast({
                title: "Erro de configuração",
                description: "Selecione um cliente no Painel da Consultoria antes de associar um usuário.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await getUserByEmail(email);
            
            if (!result.uid) {
                toast({
                    title: "Usuário não encontrado",
                    description: `Não foi possível encontrar um usuário com o email: ${email}`,
                    variant: "destructive",
                });
                return;
            }

            const userDocRef = doc(db, "users", result.uid);
            await setDoc(userDocRef, {
                clientId: role === 'consultant' ? '' : selectedClientId, // Consultants don't have a client ID
                role: role
            });

            toast({
                title: "Usuário Associado!",
                description: `${email} foi associado com sucesso.`,
            });
            
            setEmail('');
            onFinished();
        } catch (error: any) {
            toast({
                title: "Erro ao associar usuário",
                description: error.message || "Ocorreu um erro inesperado.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
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
            </div>
            <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || !email || !selectedClientId}>
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
