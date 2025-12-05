
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
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
                    description: `O acesso para ${email} foi criado. O próximo passo é associá-lo a um cliente.`,
                });
                setEmail('');
                setPassword('');
                onFinished();
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
                    Isto criará o login no sistema de autenticação. A associação ao cliente deve ser feita manualmente no Firebase Console por enquanto.
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
    return (
        <div className="py-4 space-y-4">
            <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Associação Manual Necessária</AlertTitle>
                <AlertDescription>
                    A associação de um usuário existente a um cargo precisa ser feita diretamente no console do Firebase para garantir a segurança.
                </AlertDescription>
            </Alert>
             <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={onFinished}>Fechar</Button>
            </DialogFooter>
        </div>
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
