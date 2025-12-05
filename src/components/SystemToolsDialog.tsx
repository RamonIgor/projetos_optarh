
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useClient, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateUserForm, AssociateUserForm } from './UserManagementDialog';
import { KeyRound, Loader2, DatabaseZap } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, query } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
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
                        <TabsTrigger value="migration" disabled={!isAuthorized}>Migração de Dados</TabsTrigger>
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
                        <MigrateOrphanData onFinished={() => setOpen(false)} />
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

function MigrateOrphanData({ onFinished }: { onFinished: () => void }) {
    const db = useFirestore();
    const { selectedClientId, isConsultant } = useClient();
    const { toast } = useToast();
    const [counts, setCounts] = useState({ actions: 0, activities: 0 });
    const [loading, setLoading] = useState(true);
    const [isMigrating, startMigration] = useTransition();

    useEffect(() => {
        if (!db || !isConsultant) {
            setLoading(false);
            return;
        }

        const fetchCounts = async () => {
            setLoading(true);
            try {
                const actionsQuery = query(collection(db, 'consultancy-actions'));
                const activitiesQuery = query(collection(db, 'rh-dp-activities'));

                const [actionsSnapshot, activitiesSnapshot] = await Promise.all([
                    getDocs(actionsQuery),
                    getDocs(activitiesQuery),
                ]);

                setCounts({
                    actions: actionsSnapshot.size,
                    activities: activitiesSnapshot.size,
                });
            } catch (error) {
                console.error("Error fetching orphan data counts:", error);
                toast({ title: 'Erro ao buscar dados', description: 'Não foi possível ler as coleções antigas. Verifique as permissões do Firestore.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        fetchCounts();
    }, [db, isConsultant, toast]);

    const handleMigrate = () => {
        if (!db || !selectedClientId) {
            toast({ title: 'Nenhum cliente selecionado', description: 'Por favor, selecione um cliente no painel de consultoria primeiro.', variant: 'destructive' });
            return;
        }

        const totalToMigrate = counts.activities + counts.actions;
        if (totalToMigrate === 0) {
            toast({ title: 'Nenhum dado para migrar', description: 'Não foram encontrados dados nas coleções antigas.', variant: 'default' });
            return;
        }

        startMigration(async () => {
            try {
                const batch = writeBatch(db);

                // Fetch all documents from old collections
                const actionsQuery = query(collection(db, 'consultancy-actions'));
                const activitiesQuery = query(collection(db, 'rh-dp-activities'));
                const [actionsSnapshot, activitiesSnapshot] = await Promise.all([
                    getDocs(actionsQuery),
                    getDocs(activitiesQuery),
                ]);

                // Migrate consultancy-actions to client's actions subcollection
                const targetActionsCollection = collection(db, 'clients', selectedClientId, 'actions');
                actionsSnapshot.forEach(docToMigrate => {
                    batch.set(doc(targetActionsCollection, docToMigrate.id), docToMigrate.data());
                    batch.delete(docToMigrate.ref);
                });

                // Migrate rh-dp-activities to client's activities subcollection
                const targetActivitiesCollection = collection(db, 'clients', selectedClientId, 'activities');
                activitiesSnapshot.forEach(docToMigrate => {
                    batch.set(doc(targetActivitiesCollection, docToMigrate.id), docToMigrate.data());
                    batch.delete(docToMigrate.ref);
                });

                await batch.commit();

                toast({ title: 'Migração Concluída!', description: `${totalToMigrate} registros foram migrados com sucesso para o cliente selecionado.` });
                onFinished();
            } catch (error) {
                console.error('Migration failed:', error);
                toast({ title: 'Erro na Migração', description: 'Ocorreu um erro ao migrar os dados. Verifique o console para mais detalhes.', variant: 'destructive' });
            }
        });
    }

    if (!isConsultant) {
        return <p className="text-sm text-center py-8 text-muted-foreground">Esta ferramenta está disponível apenas para consultores.</p>
    }

    if (loading) {
        return <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }
    
    const total = counts.activities + counts.actions;

    return (
        <div className="py-4 space-y-4">
             <div className='grid grid-cols-2 gap-4 text-center'>
                 <div className='p-4 bg-muted/80 rounded-lg'>
                    <h3 className="text-3xl font-bold">{counts.activities}</h3>
                    <p className="text-sm text-muted-foreground">atividades de RH/DP</p>
                 </div>
                 <div className='p-4 bg-muted/80 rounded-lg'>
                    <h3 className="text-3xl font-bold">{counts.actions}</h3>
                    <p className="text-sm text-muted-foreground">ações de consultoria</p>
                 </div>
             </div>
            <p className="text-xs text-muted-foreground text-center">
                Estes são os dados encontrados em coleções antigas que não estão associadas a nenhum cliente.
            </p>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                     <Button className="w-full" disabled={isMigrating || total === 0 || !selectedClientId}>
                        <DatabaseZap className="mr-2 h-4 w-4" />
                        Migrar {total > 0 ? `${total} Itens` : ''} para o Cliente Selecionado
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Migração?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você está prestes a mover {counts.activities} atividades e {counts.actions} ações para o cliente selecionado no painel. As coleções antigas serão excluídas após a migração. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMigrate}>Sim, migrar dados</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             {!selectedClientId && total > 0 && (
                <p className="text-center text-xs text-destructive font-medium">
                    Selecione um cliente no painel da consultoria para habilitar a migração.
                </p>
             )}
             {total === 0 && (
                 <p className="text-center text-sm text-green-600 font-medium pt-4">
                    Não há dados órfãos para migrar!
                </p>
             )}
        </div>
    )
}
