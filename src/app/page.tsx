"use client";

import { useState, useEffect, useTransition, FormEvent } from 'react';
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { type Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';

const ACTIVITIES_COLLECTION = 'rh-dp-activities';

// Simple similarity check
const isSimilar = (a: string, b: string) => {
  const cleanA = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const cleanB = b.toLowerCase().trim().replace(/\s+/g, ' ');
  return cleanA === cleanB;
};

export default function BrainstormPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivityName, setNewActivityName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const [dialogState, setDialogState] = useState<{ open: boolean; similarTo?: string; nameToAdd?: string }>({ open: false });
  
  const { toast } = useToast();

  useEffect(() => {
    if (userLoading) {
      return; // Wait until user state is resolved
    }
    if (!user) {
      router.push('/login');
      return;
    }
    if (!db) {
        setIsLoading(false);
        return;
    };
    
    const activitiesCollectionRef = collection(db, ACTIVITIES_COLLECTION);
    const q = query(activitiesCollectionRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const activitiesData: Activity[] = [];
      querySnapshot.forEach((doc) => {
        activitiesData.push({ id: doc.id, ...doc.data() } as Activity);
      });
      setActivities(activitiesData);
      setIsLoading(false);
    }, 
    async (error) => {
      const permissionError = new FirestorePermissionError({
        path: activitiesCollectionRef.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      
      toast({
        title: "Erro ao carregar atividades",
        description: "Houve um problema ao buscar os dados. Verifique as permissões de leitura.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, toast, user, userLoading, router]);

  const addActivity = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || !db) return;

    setNewActivityName("");
    
    setIsAdding(() => {
      const activityData = {
        nome: trimmedName,
        categoria: null,
        justificativa: null,
        responsavel: null,
        recorrencia: null,
        status: 'brainstorm',
        comentarios: [],
        dataAprovacao: null,
        ultimaExecucao: null,
        createdAt: serverTimestamp(),
      };

      const activitiesCollection = collection(db, ACTIVITIES_COLLECTION);
      addDoc(activitiesCollection, activityData)
        .catch(async (error) => {
          setNewActivityName(name); // Restore input on error
          const permissionError = new FirestorePermissionError({
            path: activitiesCollection.path,
            operation: 'create',
            requestResourceData: activityData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            title: "Erro ao adicionar atividade",
            description: "Não foi possível salvar a nova atividade. Verifique as permissões.",
            variant: "destructive",
          });
        });
    });
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newActivityName.trim();
    if (!trimmedName || isAdding) return;
    
    const similar = activities.find(act => isSimilar(act.nome, trimmedName));

    if (similar) {
      setDialogState({ open: true, similarTo: similar.nome, nameToAdd: trimmedName });
    } else {
      addActivity(trimmedName);
    }
  };

  const handleConfirmAdd = () => {
    if (dialogState.nameToAdd) {
      addActivity(dialogState.nameToAdd);
    }
    setDialogState({ open: false });
  };

  const handleDeleteActivity = (id: string) => {
    if (!db) return;
    startDeleteTransition(() => {
      const docRef = doc(db, ACTIVITIES_COLLECTION, id);
      deleteDoc(docRef)
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            title: "Erro ao excluir atividade",
            description: "Não foi possível excluir a atividade. Verifique as permissões.",
            variant: "destructive",
          });
        });
    });
  };
    
  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const unclassifiedCount = activities.filter(a => a.status === 'brainstorm').length;

  return (
    <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={activities.length > 0}>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl md:text-5xl font-bold text-center text-primary tracking-tight">Brainstorm de Atividades</h1>
          <p className="mt-4 text-lg text-center text-muted-foreground">Liste todas as atividades que vocês realizam hoje. Não se preocupe com a classificação ainda.</p>
        </motion.div>

        <Card className="mt-8 shadow-lg dark:shadow-black/20">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">Adicionar Nova Atividade</CardTitle>
              </div>
              <div className="text-sm font-medium text-muted-foreground pt-1">{activities.length} atividades levantadas</div>
            </div>
            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-2 pt-4">
              <Input
                type="text"
                placeholder="Ex: Processar folha de pagamento"
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                className="h-12 text-base"
                disabled={isAdding}
                aria-label="Nova atividade"
              />
              <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={isAdding || !newActivityName.trim()}>
                {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                <span className="sm:hidden">Adicionar Atividade</span>
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                 <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                 </div>
              ) : activities.length === 0 ? (
                 <div className="text-center py-10 border-2 border-dashed rounded-lg">
                  <h3 className="text-lg font-semibold">Tudo limpo por aqui!</h3>
                  <p className="mt-1 text-muted-foreground">Comece a adicionar as atividades da sua equipe no campo acima.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence>
                    {activities.map((activity) => (
                      <motion.li
                        key={activity.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="flex items-center justify-between p-3 bg-card-foreground/5 dark:bg-card-foreground/10 rounded-lg"
                      >
                        <span className="font-medium text-foreground">{activity.nome}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary">Não classificada</Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteActivity(activity.id)} disabled={isDeleting} aria-label={`Excluir ${activity.nome}`}>
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={dialogState.open} onOpenChange={(open) => setDialogState({ ...dialogState, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atividade Similar Encontrada</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma atividade chamada "{dialogState.similarTo}". Deseja adicionar "{dialogState.nameToAdd}" mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialogState({ open: false })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAdd}>Sim, adicionar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
