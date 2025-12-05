
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
import { Loader2, UserPlus } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog"


// A bit of a hack to create a compound component
// that can share the open/setOpen state.
// UserManagementDialog.Trigger
type UserManagementDialogComponent = React.FC<{ children: React.ReactNode }> & {
    Trigger: typeof DialogPrimitive.Trigger;
}

export const UserManagementDialog: UserManagementDialogComponent = ({ children }) => {
    const auth = useAuth();
    const db = useFirestore();
    const { selectedClientId } = useClient();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
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
                description: "Não foi possível identificar o cliente atual. Selecione um cliente no Painel da Consultoria antes de cadastrar um colaborador.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);
        try {
            // 1. Create the user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Create the user profile document in Firestore
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                clientId: selectedClientId,
                role: 'client_user'
            });

            // 3. (Optional but good practice) Update the client document to include this new user ID
            // This part is omitted for now as we don't have a UI to manage clients yet,
            // but it would be something like:
            // const clientDocRef = doc(db, "clients", selectedClientId);
            // await updateDoc(clientDocRef, { userIds: arrayUnion(user.uid) });

            toast({
                title: "Colaborador Cadastrado!",
                description: `O acesso para ${email} foi criado com sucesso.`,
            });
            
            // Reset form and close dialog
            setEmail('');
            setPassword('');
            setOpen(false);
        } catch (error) {
            handleAuthError(error as AuthError);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {children}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Colaboradores</DialogTitle>
                    <DialogDescription>
                        Crie uma nova conta de acesso para um membro da equipe. Ele será associado ao cliente que está selecionado no seu painel.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegister}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email do Colaborador</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@cliente.com.br"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Senha Provisória</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Mínimo de 6 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting || !email || !password || !selectedClientId}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                            )}
                            Cadastrar Colaborador
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

UserManagementDialog.Trigger = DialogPrimitive.Trigger;
