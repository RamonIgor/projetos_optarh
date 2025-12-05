"use client";

import { useState, useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserCog, UserCheck, UserX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { listAllUsers, setUserDisabledStatus, type listAllUsers as ListAllUsersType } from '@/ai/flows/user-management';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type UserRecord = ReturnType<typeof listAllUsers> extends Promise<infer U> ? U[number] : never;

function UserRow({ user }: { user: UserRecord }) {
    const { toast } = useToast();
    const [isUpdating, startUpdateTransition] = useTransition();
    const [isDisabled, setIsDisabled] = useState(user.disabled);

    const handleToggle = (uid: string, newDisabledState: boolean) => {
        startUpdateTransition(async () => {
            try {
                const result = await setUserDisabledStatus({ uid, disabled: newDisabledState });
                if (result.success) {
                    setIsDisabled(newDisabledState);
                    toast({ title: result.message });
                } else {
                    toast({ title: "Falha na operação", description: result.message, variant: 'destructive' });
                }
            } catch (error: any) {
                toast({ title: 'Erro ao atualizar usuário', description: error.message || 'Ocorreu um erro inesperado.', variant: 'destructive' });
            }
        });
    };
    
    const creationDate = user.creationTime ? format(new Date(user.creationTime), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A';
    const lastSignIn = user.lastSignInTime ? format(new Date(user.lastSignInTime), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Nunca';

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium">{user.displayName || 'Sem nome'}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
            </TableCell>
            <TableCell>
                <div>Criado em: {creationDate}</div>
                <div className="text-sm text-muted-foreground">Último login: {lastSignIn}</div>
            </TableCell>
            <TableCell>
                <Badge variant={isDisabled ? 'destructive' : 'secondary'} className="flex items-center gap-1 w-24 justify-center">
                    {isDisabled ? <UserX className="h-3 w-3"/> : <UserCheck className="h-3 w-3"/>}
                    {isDisabled ? 'Desabilitado' : 'Habilitado'}
                </Badge>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                        checked={!isDisabled}
                        onCheckedChange={(checked) => handleToggle(user.uid, !checked)}
                        disabled={isUpdating}
                        aria-label={`Habilitar ou desabilitar usuário ${user.email}`}
                    />
                </div>
            </TableCell>
        </TableRow>
    );
}

function UserList() {
    const { toast } = useToast();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const userList = await listAllUsers();
                // Sort by email
                userList.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
                setUsers(userList);
            } catch (error: any) {
                toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchUsers();
    }, [toast]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (users.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado.</div>;
    }

    return (
        <ScrollArea className="h-[60vh]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map(user => <UserRow key={user.uid} user={user} />)}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}

export function SystemToolsDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCog />
                        Gerenciamento de Usuários
                    </DialogTitle>
                    <DialogDescription>
                        Habilite ou desabilite o acesso de usuários ao sistema. A desabilitação impede o login, mas preserva todos os dados e associações do usuário.
                    </DialogDescription>
                </DialogHeader>
                <UserList />
            </DialogContent>
        </Dialog>
    );
}
