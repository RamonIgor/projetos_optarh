
"use client";

import { useState, useTransition } from 'react';
import { useClient, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateUserForm, AssociateUserForm } from './UserManagementDialog';
import { KeyRound, Loader2, DatabaseZap } from 'lucide-react';
import { useOrphanActivities } from '@/hooks/useOrphanActivities';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

export const SystemToolsDialog: React.FC<{ children: React.ReactNode, isAuthorized: boolean }> = ({ children, isAuthorized }) => {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Ferramentas do Sistema</DialogTitle>
                    <DialogDescription>
                        Gerencie colaboradores ou execute ações de manutenção no sistema.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="users">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="users" disabled={!isAuthorized}>Colaboradores</TabsTrigger>
                        <TabsTrigger value="migration" disabled={!isAuthorized}>Migração</TabsTrigger>
                        <TabsTrigger value="security">Segurança</TabsTrigger>
                    </TabsList>
                    <TabsContent value="users">
                        <Tabs defaultValue="create" className="pt-2">
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
                    </TabsContent>
                    <TabsContent value="migration">
                        <MigrateOrphanActivities onFinished={() => setOpen(false)} />
                    </TabsContent>
                     <TabsContent value="security">
                        <div className="py-4 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Altere sua senha de acesso ao sistema.
                            </p>
                             <Button className="w-full" onClick={() => { setOpen(false); router.push('/change-password'); }}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Alterar minha senha
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}


function MigrateOrphanActivities({ onFinished }: { onFinished: () => void }) {
    const db = useFirestore();
    const { selectedClientId, isConsultant } = useClient();
    const { toast } = useToast();
    const { orphanActivities, loading } = useOrphanActivities();
    const [isMigrating, startMigration] = useTransition();

    const handleMigrate = () => {
        if (!db || !selectedClientId) {
            toast({ title: 'Nenhum cliente selecionado', description: 'Por favor, selecione um cliente no painel de consultoria primeiro.', variant: 'destructive' });
            return;
        }
        if (orphanActivities.length === 0) {
            toast({ title: 'Nenhuma atividade para migrar', description: 'Não foram encontradas atividades órfãs.', variant: 'default' });
            return;
        }

        startMigration(async () => {
            const batch = writeBatch(db);
            const targetCollection = collection(db, 'clients', selectedClientId, 'activities');

            orphanActivities.forEach(activity => {
                const activityData = { ...activity };
                delete (activityData as any).id; // Remove the old id from the data object

                const newDocRef = doc(targetCollection, activity.id); // Keep the same ID
                batch.set(newDocRef, activityData);

                const oldDocRef = doc(db, 'activities', activity.id);
                batch.delete(oldDocRef);
            });

            try {
                await batch.commit();
                toast({ title: 'Migração Concluída!', description: `${orphanActivities.length} atividades foram migradas com sucesso para o cliente selecionado.` });
                onFinished();
            } catch (error) {
                console.error('Migration failed:', error);
                toast({ title: 'Erro na Migração', description: 'Ocorreu um erro ao migrar as atividades.', variant: 'destructive' });
            }
        });
    }

    if (!isConsultant) {
        return <p className="text-sm text-center py-8 text-muted-foreground">Esta ferramenta está disponível apenas para consultores.</p>
    }

    if (loading) {
        return <div className="h-24 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>
    }

    return (
        <div className="py-4 space-y-4">
             <div className='p-4 bg-muted/80 rounded-lg text-center'>
                 <h3 className="text-3xl font-bold">{orphanActivities.length}</h3>
                 <p className="text-sm text-muted-foreground">atividades órfãs encontradas</p>
             </div>
            <p className="text-xs text-muted-foreground text-center">
                Atividades órfãs são aquelas que foram criadas antes da implementação do sistema multi-cliente e não estão associadas a nenhum cliente.
            </p>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                     <Button className="w-full" disabled={isMigrating || orphanActivities.length === 0 || !selectedClientId}>
                        <DatabaseZap className="mr-2 h-4 w-4" />
                        Migrar para o Cliente Selecionado
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Migração?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você está prestes a mover {orphanActivities.length} atividades para o cliente selecionado no painel. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMigrate}>Sim, migrar atividades</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             {!selectedClientId && (
                <p className="text-center text-xs text-destructive font-medium">
                    Selecione um cliente no painel da consultoria para habilitar a migração.
                </p>
             )}
        </div>
    )
}

    