"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, Timestamp, collection, onSnapshot } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { type Survey, type Client, type SelectedQuestion } from '@/types/activity';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CalendarIcon, Info, Send, CheckSquare, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SurveyReviewPage() {
  const { surveyId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { clientId, isConsultant } = useClient();
  const { toast } = useToast();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, startPublishing] = useTransition();

  useEffect(() => {
    if (!clientId || !db) {
        setIsLoading(false);
        return;
    };

    const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
    const clientDocRef = doc(db, 'clients', clientId);

    const unsubSurvey = onSnapshot(surveyDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setSurvey(docSnap.data() as Survey);
        } else {
            toast({ title: "Pesquisa não encontrada", variant: "destructive" });
            router.push('/pulsecheck');
        }
    });

    const unsubClient = onSnapshot(clientDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setClient(docSnap.data() as Client);
        }
    });
    
    Promise.all([getDoc(surveyDocRef), getDoc(clientDocRef)]).finally(() => setIsLoading(false));

    return () => {
        unsubSurvey();
        unsubClient();
    };

  }, [surveyId, clientId, db, router, toast]);

  const handlePublish = () => {
    if (!survey || !clientId || !db) return;
    
    startPublishing(async () => {
        try {
            const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
            await updateDoc(surveyDocRef, {
                status: 'active'
            });
            toast({
                title: "Pesquisa Publicada!",
                description: `A pesquisa "${survey.title}" está agora ativa e pronta para receber respostas.`,
            });
            router.push('/pulsecheck');
        } catch (error) {
            console.error("Error publishing survey:", error);
            toast({ title: "Erro ao publicar", variant: "destructive" });
        }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl font-bold text-primary tracking-tight">Revisar e Publicar</h1>
            <p className="mt-2 text-lg text-muted-foreground">Passo 3 de 3: Confirme os detalhes e publique sua pesquisa.</p>
        </motion.div>
        
        <div className="mt-8 grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>{survey.title}</CardTitle>
                    <CardDescription>{survey.description || "Nenhuma descrição fornecida."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground"/>
                        <span>Período:</span>
                        <Badge variant="outline">{format((survey.opensAt as Timestamp).toDate(), "dd/MM/yy")} - {format((survey.closesAt as Timestamp).toDate(), "dd/MM/yy")}</Badge>
                    </div>
                     <div className="flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4 text-muted-foreground"/>
                        <span>Respostas:</span>
                        <Badge variant="outline">{survey.isAnonymous ? "Anônimas" : "Identificadas"}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground"/>
                        <span>Cliente:</span>
                        <Badge variant="secondary">{client?.name || 'Carregando...'}</Badge>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-primary" />
                        Perguntas Selecionadas ({survey.questions?.length || 0})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="h-48">
                        <ul className="space-y-2 pr-4">
                            {survey.questions?.map((q) => (
                                <li key={q.id} className="text-sm text-muted-foreground p-2 border-b">
                                    {q.text}
                                </li>
                            ))}
                        </ul>
                   </ScrollArea>
                </CardContent>
            </Card>
        </div>

        <div className="mt-10 flex justify-end">
            <Button size="lg" className="h-14 text-lg" onClick={handlePublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Publicar Pesquisa
            </Button>
        </div>
    </div>
  );
}
