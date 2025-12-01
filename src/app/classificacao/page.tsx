"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity, type ActivityComment } from '@/types/activity';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, ArrowRight, Check, Square, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';


const ACTIVITIES_COLLECTION = 'rh-dp-activities';

const CategoryButton = ({ category, selected, onClick, color, children }: any) => (
  <Button
    variant={selected ? "default" : "outline"}
    className={cn(
      "h-20 text-lg flex-1",
      selected && `border-4 ${color}`
    )}
    onClick={onClick}
  >
    {children}
  </Button>
);

const statusIcons = {
  brainstorm: <Square className="h-4 w-4 text-gray-400" />,
  aguardando_consenso: <Square className="h-4 w-4 text-yellow-500" />,
  aprovada: <Check className="h-4 w-4 text-green-500" />,
}

const statusLabels = {
  brainstorm: 'Não classificada',
  aguardando_consenso: 'Aguardando consenso',
  aprovada: 'Aprovada',
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}


export default function ClassificationPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [unclassifiedActivities, setUnclassifiedActivities] = useState<Activity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [currentCategory, setCurrentCategory] = useState<'DP' | 'RH' | 'Compartilhado' | null>(null);
  const [currentJustification, setCurrentJustification] = useState('');
  const [currentResponsible, setCurrentResponsible] = useState('');
  const [currentRecurrence, setCurrentRecurrence] = useState<'Diária' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual' | 'Sob demanda' | null>(null);
  const [newComment, setNewComment] = useState('');

  const currentActivity = useMemo(() => {
    return unclassifiedActivities.length > 0 ? unclassifiedActivities[currentIndex] : null;
  }, [unclassifiedActivities, currentIndex]);

  const classifiedCount = useMemo(() => allActivities.filter(a => a.status !== 'brainstorm').length, [allActivities]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!db) {
        setIsLoading(false);
        return;
    };
    
    const q = query(collection(db, ACTIVITIES_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setAllActivities(activitiesData);

      const unclassified = activitiesData.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso').sort((a,b) => (a.createdAt as any) - (b.createdAt as any));
      setUnclassifiedActivities(unclassified);
      
      if (unclassified.length === 0 && activitiesData.length > 0) {
        // All classified, maybe redirect or show a message
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user, userLoading, router]);

  useEffect(() => {
    if (currentActivity) {
      setCurrentCategory(currentActivity.categoria || null);
      setCurrentJustification(currentActivity.justificativa || '');
      setCurrentResponsible(currentActivity.responsavel || '');
      setCurrentRecurrence(currentActivity.recorrencia || null);
    }
  }, [currentActivity]);

  const updateActivity = async (data: Partial<Activity>) => {
    if (!currentActivity || !db) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, currentActivity.id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating activity: ", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNext = async (status: 'aguardando_consenso' | 'aprovada' = 'aguardando_consenso') => {
    const data: Partial<Activity> = {
      categoria: currentCategory,
      justificativa: currentJustification,
      responsavel: currentResponsible,
      recorrencia: currentRecurrence,
      status: status,
    };
    if (status === 'aprovada') {
      data.dataAprovacao = serverTimestamp();
    }
    await updateActivity(data);
    toast({
      title: status === 'aprovada' ? "Atividade Aprovada!" : "Progresso Salvo!",
      description: `A atividade "${currentActivity?.nome}" foi atualizada.`,
    });
    handleNext();
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?.displayName) return;
    const comment: ActivityComment = {
      autor: user.displayName,
      texto: newComment.trim(),
      data: new Date(),
    };
    await updateActivity({
      comentarios: arrayUnion(comment)
    });
    setNewComment('');
  };

  const isApproveDisabled = !currentCategory || !currentJustification || !currentResponsible;
  
  const handleNext = () => {
    if (currentIndex < unclassifiedActivities.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToActivity = (index: number) => {
    setCurrentIndex(index);
  }

  if (userLoading || isLoading) {
    return (
      <AppLayout unclassifiedCount={allActivities.length - classifiedCount} hasActivities={allActivities.length > 0}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  if (allActivities.length > 0 && unclassifiedActivities.length === 0) {
    return (
      <AppLayout unclassifiedCount={0} hasActivities={allActivities.length > 0}>
        <div className="text-center py-20">
          <Check className="h-16 w-16 mx-auto text-green-500" />
          <h1 className="mt-4 text-3xl font-bold">Parabéns!</h1>
          <p className="mt-2 text-lg text-muted-foreground">Todas as atividades foram classificadas e aprovadas.</p>
        </div>
      </AppLayout>
    )
  }

  if (allActivities.length === 0) {
    return (
       <AppLayout unclassifiedCount={0} hasActivities={false}>
        <div className="text-center py-20">
          <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade encontrada</h1>
          <p className="mt-2 text-lg text-muted-foreground">Vá para a tela de Brainstorm para adicionar novas atividades.</p>
          <Button onClick={() => router.push('/')} className="mt-6">
            Ir para Brainstorm
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout unclassifiedCount={unclassifiedActivities.length} hasActivities={allActivities.length > 0}>
      <div className="flex gap-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="fixed bottom-4 left-4 z-10 sm:hidden">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px]">
            <SheetHeader>
              <SheetTitle>Atividades</SheetTitle>
            </SheetHeader>
            <ActivityList activities={unclassifiedActivities} currentIndex={currentIndex} goToActivity={goToActivity} />
          </SheetContent>
        </Sheet>
        <aside className="w-1/4 hidden sm:block">
            <h2 className="text-lg font-semibold mb-4">Atividades</h2>
            <ActivityList activities={unclassifiedActivities} currentIndex={currentIndex} goToActivity={goToActivity} />
        </aside>
        
        <div className="flex-1">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-4xl md:text-5xl font-bold text-center text-primary tracking-tight">Classificação de Atividades</h1>
              <p className="mt-4 text-lg text-center text-muted-foreground">Vamos definir cada atividade em DP, RH ou Compartilhado</p>
            </motion.div>
            
            <div className="my-8">
              <div className="flex justify-between mb-1 text-sm text-muted-foreground">
                <span>Progresso</span>
                <span>{classifiedCount} de {allActivities.length} atividades classificadas</span>
              </div>
              <Progress value={(classifiedCount / allActivities.length) * 100} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                  key={currentActivity?.id || 'empty'}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
              >
              {currentActivity ? (
                <Card className="shadow-lg">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0}><ArrowLeft className="mr-2"/> Anterior</Button>
                        <span className="text-sm font-medium text-muted-foreground">Atividade {currentIndex + 1} de {unclassifiedActivities.length}</span>
                        <Button variant="ghost" onClick={handleNext} disabled={currentIndex === unclassifiedActivities.length - 1}>Próxima <ArrowRight className="ml-2"/></Button>
                    </div>

                    <h2 className="text-3xl font-bold text-center mb-8">{currentActivity.nome}</h2>

                    {/* Categoria */}
                    <div className="mb-8">
                      <label className="text-lg font-semibold mb-4 block">1. Categoria</label>
                      <div className="flex gap-4">
                        <CategoryButton category="DP" selected={currentCategory === 'DP'} onClick={() => setCurrentCategory('DP')} color="border-purple-500">DP</CategoryButton>
                        <CategoryButton category="RH" selected={currentCategory === 'RH'} onClick={() => setCurrentCategory('RH')} color="border-green-500">RH</CategoryButton>
                        <CategoryButton category="Compartilhado" selected={currentCategory === 'Compartilhado'} onClick={() => setCurrentCategory('Compartilhado')} color="border-blue-500">Compartilhado</CategoryButton>
                      </div>
                    </div>

                    {/* Justificativa */}
                    <div className="mb-8">
                       <label className="text-lg font-semibold mb-2 block" htmlFor="justification">2. Por que essa atividade pertence a essa categoria?</label>
                       <Textarea 
                          id="justification"
                          value={currentJustification}
                          onChange={(e) => setCurrentJustification(e.target.value)}
                          placeholder="Ex: Atividade operacional relacionada a cálculos trabalhistas..." 
                          className="min-h-[120px] text-base"
                       />
                    </div>

                    {/* Detalhes */}
                    <div className="mb-8 grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-lg font-semibold mb-2 block" htmlFor="responsible">3. Responsável</label>
                        <Input 
                          id="responsible" 
                          value={currentResponsible}
                          onChange={(e) => setCurrentResponsible(e.target.value)}
                          placeholder="Nome do colaborador" 
                          className="text-base h-12" />
                      </div>
                      <div>
                        <label className="text-lg font-semibold mb-2 block" htmlFor="recurrence">4. Recorrência</label>
                        <Select value={currentRecurrence || ''} onValueChange={(value) => setCurrentRecurrence(value as any)}>
                          <SelectTrigger className="text-base h-12" id="recurrence">
                            <SelectValue placeholder="Selecione a frequência" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Diária">Diária</SelectItem>
                            <SelectItem value="Semanal">Semanal</SelectItem>
                            <SelectItem value="Mensal">Mensal</SelectItem>
                            <SelectItem value="Trimestral">Trimestral</SelectItem>
                            <SelectItem value="Anual">Anual</SelectItem>
                            <SelectItem value="Sob demanda">Sob demanda</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                     {/* Comentários */}
                    <div className="mb-8">
                        <label className="text-lg font-semibold mb-4 block">5. Comentários / Discussão</label>
                        <div className="space-y-4">
                            {currentActivity.comentarios?.length > 0 ? (
                                <div className="max-h-40 overflow-y-auto space-y-3 pr-2">
                                {currentActivity.comentarios.map((c, i) => (
                                    <div key={i} className="text-sm bg-muted/50 p-3 rounded-lg">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-semibold">{c.autor}</span>
                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow( (c.data as any).toDate(), { addSuffix: true, locale: ptBR })}</span>
                                        </div>
                                        <p className="mt-1">{c.texto}</p>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
                            )}
                            <div className="flex gap-2">
                                <Input 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Adicionar um comentário..."
                                    className="text-base"
                                />
                                <Button onClick={handleAddComment} disabled={!newComment.trim()}>Adicionar</Button>
                            </div>
                        </div>
                    </div>


                    {/* Ações */}
                    <div className="mt-10 flex flex-col sm:flex-row justify-between gap-4">
                      <Button variant="secondary" onClick={() => handleSaveAndNext()}>Salvar e Próxima</Button>
                      <Button onClick={() => handleSaveAndNext('aprovada')} disabled={isApproveDisabled} className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-2"/>
                        Aprovar e Próxima
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-20">
                  <h2 className="text-2xl font-bold">Carregando atividade...</h2>
                  <p className="text-muted-foreground mt-2">Um momento, por favor.</p>
                </div>
              )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


function ActivityList({ activities, currentIndex, goToActivity }: { activities: Activity[], currentIndex: number, goToActivity: (index: number) => void }) {
  return (
    <ul className="space-y-2 mt-4">
      {activities.map((act, index) => (
        <li key={act.id}>
          <button
            onClick={() => goToActivity(index)}
            className={cn(
              "w-full text-left p-3 rounded-md transition-colors text-sm flex items-center gap-3",
              index === currentIndex ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/50'
            )}
          >
            <span title={statusLabels[act.status]}>{statusIcons[act.status]}</span>
            <span className="flex-1 truncate">{act.nome}</span>
            <Badge variant={index === currentIndex ? 'default' : 'secondary'} className="hidden sm:inline-flex">{statusLabels[act.status]}</Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}
