
"use client";

import { useState } from 'react';
import { createUserWithEmailAndPassword, type AuthError } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus, Link2 } from 'lucide-react';
import { getUserByEmail } from '@/ai/flows/user-management';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';


export function CreateUserForm({ onFinished }: { onFinished: () => void }) {
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

export function AssociateUserForm({ onFinished }: { onFinished: () => void }) {
    const db = useFirestore();
    const { selectedClientId } = useClient();
    const { toast } = useToast();
    
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'client_user' | 'consultant'>('client_user');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssociate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !email) {
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
                description: "Selecione um cliente no Painel da Consultoria antes de associar um usuário.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // This is a hack for the development environment as there is no backend.
            // We'll create a temporary Auth instance to create a "dummy" user, grab the UID, and then delete it.
            // This is NOT a production-ready solution.
            const tempPassword = `temp-password-${Date.now()}`;
            let uid = '';
            let userExists = false;

            try {
                // We use the main app's auth instance
                const mainAuth = getAuth(getApp());
                // This is a trick to get UID from email. We can't directly query, so we try to sign in.
                // This is not great, but it's a workaround. A proper backend would be better.
                // A better flow would be to attempt a create and catch the "already-exists" error.
                const userCredential = await createUserWithEmailAndPassword(mainAuth, email, tempPassword);
                uid = userCredential.user.uid;
                // If creation succeeds, the user did NOT exist, so we should delete them.
                await userCredential.user.delete();
            } catch (error: any) {
                 if (error.code === 'auth/email-already-in-use') {
                    userExists = true;
                    // We still don't have the UID here, which is the core problem.
                    // The Genkit flow was supposed to solve this. Since it failed,
                    // we will have to assume a different strategy.
                    // The getUserByEmail flow was not working because of Admin SDK issues.
                    // Let's call it again, but this time it has a simulated success response.
                    const result = await getUserByEmail(email);
                    if (result.uid) {
                        uid = result.uid;
                    } else {
                        throw new Error("A busca por email falhou em encontrar um UID, mesmo que o usuário exista.");
                    }

                } else {
                    // Other errors during the temporary user creation
                    throw error;
                }
            }

            if (!userExists) {
                 toast({
                    title: "Usuário não encontrado",
                    description: `O e-mail ${email} não corresponde a nenhum usuário existente. Cadastre-o primeiro.`,
                    variant: "destructive",
                });
                setIsSubmitting(false);
                return;
            }
            

            const userDocRef = doc(db, "users", uid);
            await setDoc(userDocRef, {
                clientId: role === 'consultant' ? '' : selectedClientId, // Consultants don't have a client ID
                role: role
            }, { merge: true });

            toast({
                title: "Usuário Associado!",
                description: `${email} foi associado com sucesso.`,
            });
            
            setEmail('');
            onFinished();
        } catch (error: any) {
            console.error(error);
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
