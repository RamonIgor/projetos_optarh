"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, serverTimestamp, where, getDocs } from 'firebase/firestore';
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
import { Loader2, ArrowLeft, Check, Square, ChevronsRight, ListTodo, ActivitySquare, ThumbsUp, RotateCcw } from 'lucide-react';
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
      "h-20 text-lg flex-1 transition-all duration-200",
      selected && `border-4 shadow-lg transform scale-105 ${color}`,
      selected ? 'bg-primary' : ''
    )}
    style={selected ? { borderColor: color } : {}}
    onClick={onClick}
  >
    {children}
  </Button>
);

const statusIcons = {
  brainstorm: <Square className="h-4 w-4 text-gray-400" />,
  aguardando_consenso: <ActivitySquare className="h-4 w-4 text-yellow-500" />,
  aprovada: <ThumbsUp className="h-4 w-4 text-green-500" />,
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
  const [activitiesToClassify, setActivitiesToClassify] = useState<Activity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  const [currentCategory, setCurrentCategory] = useState<'DP' | 'RH' | 'Compartilhado' | null>(null);
  const [currentJustification, setCurrentJustification] = useState('');
  const [currentResponsible, setCurrentResponsible] = useState('');
  const [currentRecurrence, setCurrentRecurrence] = useState<'Diária' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual' | 'Sob demanda' | null>(null);
  const [newComment, setNewComment] = useState('');

  const currentActivity = useMemo(() => {
    return activitiesToClassify.length > 0 ? activitiesToClassify[currentIndex] : null;
  }, [activitiesToClassify, currentIndex]);

  const classifiedCount = useMemo(() => allActivities.filter(a => a.status === 'aprovada').length, [allActivities]);
  
  const summaryStats = useMemo(() => {
    return {
      approved: allActivities.filter(a => a.status === 'aprovada').length,
      pending: allActivities.filter(a => a.status === 'aguardando_consenso').length,
      unclassified: allActivities.filter(a => a.status === 'brainstorm').length,
    }
  }, [allActivities]);

  const fetchActivities = (filter: 'all' | 'pending' = 'pending') => {
    if (!db) return;
    setIsLoading(true);
    
    // Listener for all activities to calculate stats
    const allQuery = query(collection(db, ACTIVITIES_COLLECTION));
    const unsubAll = onSnapshot(allQuery, (snapshot) => {
        const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        setAllActivities(activitiesData);
    });

    // Listener for activities to classify
    let classifyQuery;
    if (filter === 'pending') {
      classifyQuery = query(collection(db, ACTIVITIES_COLLECTION), where('status', '!=', 'aprovada'));
    } else {
      classifyQuery = query(collection(db, ACTIVITIES_COLLECTION));
    }
    const unsubClassify = onSnapshot(classifyQuery, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      const sortedToClassify = activitiesData.sort((a,b) => (a.createdAt as any) - (b.createdAt as any));
      
      setActivitiesToClassify(sortedToClassify);

      if (sortedToClassify.length === 0 && allActivities.length > 0) {
        setShowSummary(true);
      } else {
        setShowSummary(false);
      }
      
      setCurrentIndex(0);
      setIsLoading(false);
    });

    return () => {
        unsubAll();
        unsubClassify();
    }
  }
  
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

    const unsubscribe = fetchActivities('pending');

    return () => {
      if(unsubscribe) unsubscribe();
    };
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

  const handleRevertToBrainstorm = async () => {
    if (!currentActivity || !db || isSaving) return;

    const data: Partial<Activity> = {
      categoria: null,
      justificativa: null,
      responsavel: null,
      recorrencia: null,
      status: 'brainstorm',
      dataAprovacao: null,
    };
    
    await updateActivity(data);

    toast({
        title: "Atividade Revertida!",
        description: `A atividade "${currentActivity?.nome}" voltou para o estágio de Brainstorm.`,
    });

    handleNext(false); // Move to next without saving again
  }

  const handleSaveAndNext = async (status?: 'aguardando_consenso' | 'aprovada') => {
    if (isSaving || !currentActivity) return;
    
    const hasChanged = (
      currentActivity.categoria !== currentCategory ||
      currentActivity.justificativa !== currentJustification ||
      currentActivity.responsavel !== currentResponsible ||
      currentActivity.recorrencia !== currentRecurrence
    );

    let newStatus = currentActivity.status;
    if (status) {
        newStatus = status;
    } else if (hasChanged && newStatus !== 'aguardando_consenso') {
        newStatus = 'aguardando_consenso';
    }


    const data: Partial<Activity> = {
      categoria: currentCategory,
      justificativa: currentJustification,
      responsavel: currentResponsible,
      recorrencia: currentRecurrence,
      status: newStatus,
    };

    if (newStatus === 'aprovada' && currentActivity.status !== 'aprovada') {
      data.dataAprovacao = serverTimestamp();
    }
    
    await updateActivity(data);
    
    if (status || hasChanged) {
        toast({
            title: status === 'aprovada' ? "Atividade Aprovada!" : "Progresso Salvo!",
            description: `A atividade "${currentActivity?.nome}" foi atualizada.`,
        });
    }
    
    handleNext(false);
  };


  const handleNext = (save = true) => {
     if (save) {
        handleSaveAndNext();
        return;
     }
     if (currentIndex < activitiesToClassify.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handleApprove = () => {
    handleSaveAndNext('aprovada');
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?.email || !currentActivity) return;
    const comment: ActivityComment = {
      autor: user.email,
      texto: newComment.trim(),
      data: new Date(),
    };
    const docRef = doc(db, ACTIVITIES_COLLECTION, currentActivity.id);
    await updateDoc(docRef, {
      comentarios: arrayUnion(comment)
    });
    setNewComment('');
  };

  const isApproveDisabled = !currentCategory || !currentJustification || !currentResponsible;
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToActivity = (index: number) => {
    setCurrentIndex(index);
    setShowSummary(false);
  }
  
  const unclassifiedCount = allActivities.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso').length;

  if (userLoading || isLoading) {
    return (
      <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  if (showSummary) {
    return (
        <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
            <SummaryScreen stats={summaryStats} onReviewPending={() => fetchActivities('pending')} />
        </AppLayout>
    )
  }

  if (allActivities.length > 0 && activitiesToClassify.length === 0 && !showSummary) {
    return (
      <AppLayout unclassifiedCount={0} hasActivities={allActivities.length > 0}>
         <SummaryScreen stats={summaryStats} onReviewPending={() => fetchActivities('pending')} />
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
    <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
      <div className="flex gap-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="fixed bottom-4 left-4 z-10 sm:hidden">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Revisão de Atividades</SheetTitle>
            </SheetHeader>
            <ActivityList activities={activitiesToClassify} currentIndex={currentIndex} goToActivity={goToActivity} />
          </SheetContent>
        </Sheet>
        <aside className="w-1/4 hidden sm:block border-r pr-6">
            <h2 className="text-lg font-semibold mb-4">Revisão de Atividades</h2>
            <ActivityList activities={activitiesToClassify} currentIndex={currentIndex} goToActivity={goToActivity} />
        </aside>
        
        <div className="flex-1">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-4xl md:text-5xl font-bold text-center text-primary tracking-tight">Classificação de Atividades</h1>
              <p className="mt-4 text-lg text-center text-muted-foreground">Vamos definir cada atividade em DP, RH ou Compartilhado</p>
            </motion.div>
            
            <div className="my-8">
              <div className="flex justify-between mb-1 text-sm text-muted-foreground">
                <span>Progresso da Aprovação</span>
                <span>{classifiedCount} de {allActivities.length} atividades aprovadas</span>
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
                <Card className="shadow-lg overflow-hidden">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0}><ArrowLeft className="mr-2 h-4 w-4"/> Anterior</Button>
                        <span className="text-sm font-medium text-muted-foreground">Atividade {currentIndex + 1} de {activitiesToClassify.length}</span>
                        <Button variant="ghost" onClick={() => handleNext()}>
                            {currentIndex === activitiesToClassify.length - 1 ? 'Finalizar Revisão' : 'Próxima'}
                            {currentIndex !== activitiesToClassify.length - 1 && <ArrowLeft className="ml-2 h-4 w-4 transform rotate-180"/>}
                        </Button>
                    </div>

                    <h2 className="text-3xl font-bold text-center mb-8">{currentActivity.nome}</h2>

                    {/* Categoria */}
                    <div className="mb-8">
                      <label className="text-lg font-semibold mb-4 block">1. Categoria</label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <CategoryButton category="DP" selected={currentCategory === 'DP'} onClick={() => setCurrentCategory('DP')} color="purple">DP</CategoryButton>
                        <CategoryButton category="RH" selected={currentCategory === 'RH'} onClick={() => setCurrentCategory('RH')} color="green">RH</CategoryButton>
                        <CategoryButton category="Compartilhado" selected={currentCategory === 'Compartilhado'} onClick={() => setCurrentCategory('Compartilhado')} color="blue">Compartilhado</CategoryButton>
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
                                <div className="max-h-40 overflow-y-auto space-y-3 pr-2 border rounded-lg p-3 bg-muted/50">
                                {currentActivity.comentarios.sort((a,b) => (b.data as any) - (a.data as any)).map((c, i) => (
                                    <div key={i} className="text-sm bg-background p-3 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-semibold">{c.autor}</span>
                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow( (c.data as any).toDate ? (c.data as any).toDate() : new Date(c.data), { addSuffix: true, locale: ptBR })}</span>
                                        </div>
                                        <p className="mt-1 text-muted-foreground">{c.texto}</p>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">Nenhum comentário ainda.</p>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Input 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Adicionar um comentário..."
                                    className="text-base"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                />
                                <Button onClick={handleAddComment} disabled={!newComment.trim() || isSaving}>Adicionar</Button>
                            </div>
                        </div>
                    </div>


                    {/* Ações */}
                     <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            {currentActivity.status !== 'brainstorm' && (
                               <Button variant="destructive" onClick={handleRevertToBrainstorm} disabled={isSaving}>
                                 <RotateCcw className="mr-2 h-4 w-4"/> Reverter para Brainstorm
                               </Button>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button variant="secondary" onClick={() => handleSaveAndNext()} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Salvar e Próxima
                          </Button>
                          <Button onClick={handleApprove} disabled={isApproveDisabled || isSaving} className="bg-green-600 hover:bg-green-700">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                            Aprovar e Próxima
                          </Button>
                        </div>
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
    <div className="h-full overflow-y-auto p-4">
      <ul className="space-y-2">
        {activities.map((act, index) => (
          <li key={act.id}>
            <button
              onClick={() => goToActivity(index)}
              className={cn(
                "w-full text-left p-3 rounded-md transition-colors text-sm flex items-center gap-3",
                index === currentIndex ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
              )}
            >
              <span title={statusLabels[act.status]}>{statusIcons[act.status as keyof typeof statusIcons]}</span>
              <span className="flex-1 truncate">{act.nome}</span>
              <Badge variant={index === currentIndex ? 'default' : 'secondary'} className="hidden lg:inline-flex">{statusLabels[act.status]}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SummaryScreen({ stats, onReviewPending }: { stats: { approved: number, pending: number, unclassified: number }, onReviewPending: () => void }) {
  const router = useRouter();
  const total = stats.approved + stats.pending + stats.unclassified;
  const approvedPercentage = total > 0 ? (stats.approved / total) * 100 : 0;

  const StatCard = ({ title, value, color, icon }: { title: string, value: number, color: string, icon: React.ReactNode }) => (
    <Card className={cn("border-l-4", color)}>
      <CardContent className="p-6 flex items-center gap-4">
        {icon}
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-3xl mx-auto text-center py-12">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-5xl font-bold tracking-tight">🎉 Primeira rodada concluída!</h1>
        <p className="mt-4 text-lg text-muted-foreground">Vocês revisaram todas as atividades. Veja o resumo:</p>
      
        <div className="grid md:grid-cols-3 gap-4 my-8 text-left">
          <StatCard title="Atividades Aprovadas" value={stats.approved} color="border-green-500" icon={<ThumbsUp className="h-8 w-8 text-green-500" />}/>
          <StatCard title="Aguardando Consenso" value={stats.pending} color="border-yellow-500" icon={<ActivitySquare className="h-8 w-8 text-yellow-500" />}/>
          <StatCard title="Não Classificadas" value={stats.unclassified} color="border-gray-400" icon={<Square className="h-8 w-8 text-gray-400" />}/>
        </div>

        <div className="my-8">
            <div className="flex justify-between mb-1 text-sm text-muted-foreground">
                <span>Progresso de Aprovação</span>
                <span>{Math.round(approvedPercentage)}%</span>
            </div>
            <Progress value={approvedPercentage} className="h-3 [&>div]:bg-green-500" />
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <Button size="lg" className="h-16 text-lg" onClick={onReviewPending} disabled={stats.pending === 0 && stats.unclassified === 0}>
              Revisar Pendentes
          </Button>
          <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={() => {/* no-op */}}>
              Ir para o Dashboard
          </Button>
          <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => router.push('/')}>
              Voltar ao Brainstorm
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

    