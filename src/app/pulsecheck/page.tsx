"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useRouter } from 'next/navigation';
import { type Survey, type Response as SurveyResponse } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, PlusCircle, Inbox } from 'lucide-react';
import { SurveyCard } from './_components/SurveyCard';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';

export default function PulseCheckDashboard() {
  const db = useFirestore();
  const { clientId, isClientLoading, isConsultant } = useClient();
  const router = useRouter();
  const { toast } = useToast();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<Record<string, SurveyResponse[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);

  const isLoadingPage = isClientLoading || isLoading;

  useEffect(() => {
    if (isClientLoading) return;

    if (!clientId) {
      if (isConsultant) {
        toast({ title: "Selecione um cliente", description: "Por favor, selecione um cliente no Painel de Consultoria para ver as pesquisas." });
      }
      setSurveys([]);
      setResponses({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Listener for surveys
    const surveysQuery = query(
      collection(db, 'clients', clientId, 'surveys'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeSurveys = onSnapshot(surveysQuery, (snapshot) => {
      const surveysData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Survey));
      setSurveys(surveysData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching surveys:", error);
      toast({ title: "Erro ao buscar pesquisas", variant: "destructive" });
      setIsLoading(false);
    });

    // Listener for responses
    const responsesQuery = query(
      collection(db, 'pulse_check_responses'),
      where('clientId', '==', clientId)
    );
    const unsubscribeResponses = onSnapshot(responsesQuery, (snapshot) => {
      const responsesData = snapshot.docs.map(doc => doc.data() as SurveyResponse);
      const groupedBySurvey = responsesData.reduce((acc, response) => {
        const surveyId = response.surveyId;
        if (!acc[surveyId]) {
          acc[surveyId] = [];
        }
        acc[surveyId].push(response);
        return acc;
      }, {} as Record<string, SurveyResponse[]>);
      setResponses(groupedBySurvey);
    }, (error) => {
      console.error("Error fetching responses:", error);
      toast({ title: "Erro ao buscar respostas", variant: "destructive" });
    });


    return () => {
      unsubscribeSurveys();
      unsubscribeResponses();
    };
  }, [clientId, db, isClientLoading, isConsultant, toast]);

  const handleDelete = async () => {
    if (!deletingSurveyId || !clientId) return;
    
    try {
        await deleteDoc(doc(db, 'clients', clientId, 'surveys', deletingSurveyId));
        
        const responsesQuery = query(collection(db, 'pulse_check_responses'), where('surveyId', '==', deletingSurveyId));
        const responseSnapshot = await getDocs(responsesQuery);
        const batch = responseSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(batch);

        toast({ title: "Pesquisa excluída com sucesso!" });
    } catch (error) {
        console.error("Error deleting survey:", error);
        toast({ title: "Erro ao excluir pesquisa", variant: "destructive" });
    } finally {
        setDeletingSurveyId(null);
    }
  };

  const EmptyState = () => (
    <Card className="mt-8 shadow-lg dark:shadow-black/20">
      <CardContent className="text-center py-20">
        <div className="flex justify-center items-center mb-6">
          <Inbox className="h-16 w-16 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Nenhuma pesquisa criada ainda</h2>
        <p className="mt-2 text-muted-foreground">Comece a medir o clima da sua equipe criando sua primeira pesquisa.</p>
      </CardContent>
    </Card>
  );
  
  const NoClientState = () => (
     <Card className="mt-8 shadow-lg dark:shadow-black/20">
        <CardContent className="text-center py-20">
            <div className="flex justify-center items-center mb-6">
                <Inbox className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Nenhum cliente selecionado</h2>
            <p className="mt-2 text-muted-foreground">Vá ao Painel de Consultoria para selecionar um cliente e visualizar suas pesquisas.</p>
            <Button className="mt-6" size="lg" onClick={() => router.push('/consultoria')}>
                Ir para o Painel
            </Button>
        </CardContent>
    </Card>
  );

  return (
      <div className="max-w-7xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex justify-between items-center">
             <div>
                <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Minhas Pesquisas</h1>
                <p className="mt-4 text-lg text-muted-foreground">Visualize, edite e acompanhe o resultado das suas pesquisas de clima.</p>
             </div>
              <Button size="lg" onClick={() => router.push('/pulsecheck/editor')} disabled={!clientId}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Nova Pesquisa
              </Button>
          </div>
        </motion.div>

        <div className="mt-8">
            {isLoadingPage ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            ) : !clientId && isConsultant ? (
            <NoClientState />
            ) : surveys.length === 0 ? (
            <EmptyState />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map(survey => (
                <SurveyCard 
                    key={survey.id} 
                    survey={survey} 
                    responses={responses[survey.id] || []}
                    onDelete={() => setDeletingSurveyId(survey.id)}
                />
                ))}
            </div>
            )}
        </div>

       <AlertDialog open={!!deletingSurveyId} onOpenChange={(open) => !open && setDeletingSurveyId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente a pesquisa e todas as suas respostas.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
