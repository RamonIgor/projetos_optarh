"use client";

import { useState, useEffect, useTransition, FormEvent } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { type Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const ACTIVITIES_COLLECTION = 'rh-dp-activities';

// Simple similarity check
const isSimilar = (a: string, b: string) => {
  const cleanA = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const cleanB = b.toLowerCase().trim().replace(/\s+/g, ' ');
  return cleanA === cleanB;
};

export default function BrainstormPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivityName, setNewActivityName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [dialogState, setDialogState] = useState<{ open: boolean; similarTo?: string; nameToAdd?: string }>({ open: false });
  
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, ACTIVITIES_COLLECTION), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const activitiesData: Activity[] = [];
      querySnapshot.forEach((doc) => {
        activitiesData.push({ id: doc.id, ...doc.data() } as Activity);
      });
      setActivities(activitiesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching activities: ", error);
      toast({
        title: "Erro ao carregar atividades",
        description: "Houve um problema ao buscar os dados. Tente recarregar a página.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const addActivity = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    startTransition(async () => {
      try {
        await addDoc(collection(db, ACTIVITIES_COLLECTION), {
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
        });
        setNewActivityName("");
      } catch (error) {
        console.error("Error adding activity: ", error);
        toast({
          title: "Erro ao adicionar atividade",
          description: "Não foi possível salvar a nova atividade. Tente novamente.",
          variant: "destructive",
        });
      }
    });
  };

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newActivityName.trim();
    if (!trimmedName || isPending) return;
    
    const similar = activities.find(act => isSimilar(act.nome, trimmedName));

    if (similar) {
      setDialogState({ open: true, similarTo: similar.nome, nameToAdd: trimmedName });
    } else {
      await addActivity(trimmedName);
    }
  };

  const handleConfirmAdd = async () => {
    if (dialogState.nameToAdd) {
      await addActivity(dialogState.nameToAdd);
    }
    setDialogState({ open: false });
  };

  const handleDeleteActivity = (id: string) => {
    startTransition(async () => {
      try {
        await deleteDoc(doc(db, ACTIVITIES_COLLECTION, id));
      } catch (error) {
        console.error("Error deleting activity: ", error);
        toast({
          title: "Erro ao excluir atividade",
          description: "Não foi possível excluir a atividade. Tente novamente.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <>
      <div className="min-h-screen w-full">
        <main className="container mx-auto p-4 sm:p-6 md:p-8">
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
                    disabled={isPending}
                    aria-label="Nova atividade"
                  />
                  <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={isPending || !newActivityName.trim()}>
                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    <span className="sm:hidden">Adicionar Atividade</span>
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </form>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : activities.length > 0 ? (
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteActivity(activity.id)} disabled={isPending} aria-label={`Excluir ${activity.nome}`}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                      <h3 className="text-lg font-semibold">Tudo limpo por aqui!</h3>
                      <p className="mt-1 text-muted-foreground">Comece a adicionar as atividades da sua equipe no campo acima.</p>
                    </div>
                  )}
                </div>
              </CardContent>
              {activities.length > 0 && (
                <CardFooter>
                  <Button className="w-full" size="lg">
                    Finalizar Brainstorm e Iniciar Classificação
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </main>
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
    </>
  );
}
