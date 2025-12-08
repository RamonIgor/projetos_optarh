"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
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
import { Loader2, ArrowLeft, Check, Square, ChevronsRight, ListTodo, ActivitySquare, ThumbsUp, RotateCcw, MessageSquare, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';



const CategoryButton = ({ category, selected, onClick, color, children }: any) => (
  <Button
    variant={selected ? "default" : "outline"}
    className={cn(
      "h-24 text-lg w-full transition-all duration-200",
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

function getCommentDate(comment: ActivityComment): Date | null {
    if (!comment.data) return null;
    if ((comment.data as Timestamp)?.toDate) {
        return (comment.data as Timestamp).toDate();
    }
    if (comment.data instanceof Date) {
        return comment.data;
    }
    if (typeof comment.data === 'string') {
        const parsedDate = new Date(comment.data);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    return null;
}

function CommentItem({ comment }: { comment: ActivityComment }) {
    const [dateString, setDateString] = useState('data indisponível');

    useEffect(() => {
        const commentDate = getCommentDate(comment);
        if (commentDate) {
            setDateString(formatDistanceToNow(commentDate, { addSuffix: true, locale: ptBR }));
        }
    }, [comment]);

    return (
        <div className="text-sm bg-background p-3 rounded-lg shadow-sm">
            <div className="flex justify-between items-baseline">
                <span className="font-semibold">{comment.autor}</span>
                <span className="text-xs text-muted-foreground">
                    {dateString}
                </span>
            </div>
            <p className="mt-1 text-muted-foreground">{comment.texto}</p>
        </div>
    );
}

export default function ClassificationPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const { clientId, isClientLoading } = useClient();
  const router = useRouter();
  const { toast } = useToast();

  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<'pending' | 'approved'>('pending');
  
  const [currentCategory, setCurrentCategory] = useState<'DP' | 'RH' | 'Compartilhado' | null>(null);
  const [currentJustification, setCurrentJustification] = useState('');
  const [currentResponsible, setCurrentResponsible] = useState('');
  const [currentRecurrence, setCurrentRecurrence] = useState<'Diária' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual' | 'Sob demanda' | null>(null);
  const [newComment, setNewComment] = useState('');

  const currentActivity = useMemo(() => {
    return filteredActivities.find(a => a.id === currentActivityId) || null;
  }, [filteredActivities, currentActivityId]);

  const classifiedCount = useMemo(() => allActivities.filter(a => a.status === 'aprovada').length, [allActivities]);
  
  const summaryStats = useMemo(() => {
    return {
      approved: allActivities.filter(a => a.status === 'aprovada').length,
      pending: allActivities.filter(a => a.status === 'aguardando_consenso').length,
      unclassified: allActivities.filter(a => a.status === 'brainstorm').length,
    }
  }, [allActivities]);

  const isLoadingPage = userLoading || isClientLoading;
  
  useEffect(() => {
    if (isLoadingPage) {
        setIsLoading(true);
        return;
    }
    
    if (!user) {
      router.push('/login');
      return;
    }
    if (!db) {
        setIsLoading(false);
        return;
    };
    
    if (!clientId) {
      setIsLoading(false);
      setAllActivities([]);
      setFilteredActivities([]);
      return;
    }

    setIsLoading(true);
    const activitiesCollectionRef = collection(db, 'clients', clientId, 'activities');
    
    const allQuery = query(activitiesCollectionRef);
    const unsubAll = onSnapshot(allQuery, (snapshot) => {
        const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        setAllActivities(activitiesData);
    });

    const fetchActivities = () => {
        let classifyQuery;
        if (view === 'pending') {
            classifyQuery = query(activitiesCollectionRef, where('status', '!=', 'aprovada'));
        } else { // 'approved'
            classifyQuery = query(activitiesCollectionRef, where('status', '==', 'aprovada'));
        }

        const unsubClassify = onSnapshot(classifyQuery, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            const sortedActivities = activitiesData.sort((a,b) => {
              const timeA = (a.createdAt as Timestamp)?.seconds || 0;
              const timeB = (b.createdAt as Timestamp)?.seconds || 0;
              return timeA - timeB;
            });
            
            setFilteredActivities(sortedActivities);

            if (!currentActivityId && sortedActivities.length > 0) {
              setCurrentActivityId(sortedActivities[0].id);
            } else if (sortedActivities.length === 0) {
              setCurrentActivityId(null);
            }
            
            setIsLoading(false);
        }, () => {
          setIsLoading(false);
        });

        return unsubClassify;
    }
    
    const unsubscribe = fetchActivities();

    return () => {
        unsubAll();
        unsubscribe();
    }
  }, [db, user, router, view, clientId, isLoadingPage, currentActivityId]);

  useEffect(() => {
    if (currentActivity) {
      setCurrentCategory(currentActivity.categoria || null);
      setCurrentJustification(currentActivity.justificativa || '');
      setCurrentResponsible(currentActivity.responsavel || '');
      setCurrentRecurrence(currentActivity.recorrencia || null);
    } else {
      setCurrentCategory(null);
      setCurrentJustification('');
      setCurrentResponsible('');
      setCurrentRecurrence(null);
    }
  }, [currentActivity]);

  const updateActivity = async (data: Partial<Activity>) => {
    if (!currentActivity || !db || !clientId) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'clients', clientId, 'activities', currentActivity.id);
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
  
  const handleSaveAndSelectNext = async (status?: 'aguardando_consenso' | 'aprovada') => {
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
    
    const currentIndex = filteredActivities.findIndex(a => a.id === currentActivity.id);
    const nextActivity = filteredActivities[currentIndex + 1];
    if (nextActivity) {
      setCurrentActivityId(nextActivity.id);
    } else {
      setCurrentActivityId(null);
    }
  };

  const handleRevertToBrainstorm = async () => {
    if (!currentActivity || !db || isSaving) return;

    const data: Partial<Activity> = {
      status: 'brainstorm',
      dataAprovacao: null,
    };
    
    await updateActivity(data);

    toast({
        title: "Atividade Revertida!",
        description: `A atividade "${currentActivity?.nome}" voltou para o estágio de Brainstorm.`,
    });
  }

  const handleApprove = () => {
    handleSaveAndSelectNext('aprovada');
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?.email || !currentActivity || !clientId) return;
    const comment: ActivityComment = {
      autor: user.email,
      texto: newComment.trim(),
      data: new Date(),
    };
    const docRef = doc(db, 'clients', clientId, 'activities', currentActivity.id);
    await updateDoc(docRef, {
      comentarios: arrayUnion(comment)
    });
    setNewComment('');
  };

  const isApproveDisabled = !currentCategory || !currentJustification || !currentResponsible;
  
  const goToActivity = (id: string) => {
    setCurrentActivityId(id);
  }
  
  if (isLoadingPage || (isLoading && allActivities.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (allActivities.length === 0 && !isClientLoading) {
    return (
        <div className="text-center py-20 flex-1">
          <h1 className="mt-4 text-3xl font-bold">Nenhuma atividade encontrada</h1>
          <p className="mt-2 text-lg text-muted-foreground">Vá para a tela de Brainstorm para adicionar novas atividades.</p>
          <Button onClick={() => router.push('/processflow/brainstorm')} className="mt-6">
            Ir para Brainstorm
          </Button>
        </div>
    )
  }

  return (
    <div className="flex gap-8 h-full w-full">
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
          <div className="p-4">
            <Tabs value={view} onValueChange={(v) => setView(v as 'pending' | 'approved')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="approved">Aprovadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ActivityList allActivities={allActivities} activities={filteredActivities} currentActivityId={currentActivityId} goToActivity={goToActivity} />
        </SheetContent>
      </Sheet>

      <aside className="w-1/4 hidden sm:block border-r pr-6">
          <h2 className="text-lg font-semibold mb-4">Revisão de Atividades</h2>
            <Tabs value={view} onValueChange={(v) => { setView(v as 'pending' | 'approved'); setCurrentActivityId(null); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            </TabsList>
            </Tabs>
          <ActivityList allActivities={allActivities} activities={filteredActivities} currentActivityId={currentActivityId} goToActivity={goToActivity} />
      </aside>
      
      <div className="flex-1 flex flex-col">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Classificação de Atividades</h1>
            <p className="mt-2 text-md text-muted-foreground">Selecione uma atividade na lista para começar a classificar.</p>
          </motion.div>
          
          <div className="my-4">
            <div className="flex justify-between mb-1 text-sm text-muted-foreground">
              <span>Progresso da Aprovação</span>
              <span>{classifiedCount} de {allActivities.length} atividades aprovadas</span>
            </div>
            <Progress value={(classifiedCount / (allActivities.length || 1)) * 100} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
                key={currentActivity?.id || 'empty'}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
            >
            {currentActivity ? (
              <Card className="shadow-lg overflow-hidden flex-1 flex flex-col">
                <CardContent className="p-6 md:p-8 flex-1 flex flex-col">
                  <div className="grid md:grid-cols-2 gap-8 flex-1">
                    {/* Coluna da Esquerda */}
                    <div className="flex flex-col space-y-6">
                        <h2 className="text-3xl font-bold mb-2">{currentActivity.nome}</h2>
                        <div>
                            <label className="text-lg font-semibold mb-4 block">1. Categoria</label>
                            <div className="flex flex-col gap-4">
                              <CategoryButton category="DP" selected={currentCategory === 'DP'} onClick={() => setCurrentCategory('DP')} color="purple">DP</CategoryButton>
                              <CategoryButton category="RH" selected={currentCategory === 'RH'} onClick={() => setCurrentCategory('RH')} color="green">RH</CategoryButton>
                              <CategoryButton category="Compartilhado" selected={currentCategory === 'Compartilhado'} onClick={() => setCurrentCategory('Compartilhado')} color="blue">Compartilhado</CategoryButton>
                            </div>
                        </div>
                    </div>

                    {/* Coluna da Direita */}
                    <div className="flex flex-col space-y-4">
                          <div className="h-[52px] mb-2"></div>
                        <div>
                            <label className="text-lg font-semibold mb-2 block" htmlFor="justification">2. Justificativa</label>
                            <Textarea 
                              id="justification"
                              value={currentJustification}
                              onChange={(e) => setCurrentJustification(e.target.value)}
                              placeholder="Ex: Atividade operacional relacionada a cálculos trabalhistas..." 
                              className="min-h-[100px] text-base"
                            />
                        </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-lg font-semibold mb-2 block" htmlFor="responsible">3. Responsável</label>
                              <Input 
                                id="responsible" 
                                value={currentResponsible}
                                onChange={(e) => setCurrentResponsible(e.target.value)}
                                placeholder="Nome" 
                                className="text-base h-11" />
                            </div>
                            <div>
                              <label className="text-lg font-semibold mb-2 block" htmlFor="recurrence">4. Recorrência</label>
                              <Select value={currentRecurrence || ''} onValueChange={(value) => setCurrentRecurrence(value as any)}>
                                <SelectTrigger className="text-base h-11" id="recurrence">
                                  <SelectValue placeholder="Frequência" />
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

                          <div className="pt-2">
                              <CommentSheet 
                                  activity={currentActivity}
                                  newComment={newComment}
                                  setNewComment={setNewComment}
                                  onAddComment={handleAddComment}
                                  isSaving={isSaving}
                              />
                          </div>
                    </div>
                  </div>


                    <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                          {currentActivity.status !== 'brainstorm' && (
                              <Button variant="outline" onClick={handleRevertToBrainstorm} disabled={isSaving}>
                                <RotateCcw className="mr-2 h-4 w-4"/> Reverter
                              </Button>
                          )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={() => handleSaveAndSelectNext()} disabled={isSaving}>
                            Salvar e Próximo
                          </Button>
                        <Button onClick={handleApprove} disabled={isApproveDisabled || isSaving} className="bg-green-600 hover:bg-green-700">
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                          Aprovar Atividade
                        </Button>
                      </div>
                  </div>

                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-20 flex-1 flex flex-col items-center justify-center bg-muted/50 rounded-lg border-2 border-dashed">
                  {isLoading ? (
                    <>
                      <h2 className="text-2xl font-bold">Carregando atividades...</h2>
                      <Loader2 className="h-8 w-8 animate-spin text-primary mt-4"/>
                    </>
                  ) : (
                      <>
                        <Hand className="h-12 w-12 text-primary mb-4" />
                        <h2 className="text-2xl font-bold">Selecione uma atividade</h2>
                        <p className="text-muted-foreground mt-2">Escolha uma atividade da lista ao lado para começar.</p>
                      </>
                  )}
              </div>
            )}
            </motion.div>
          </AnimatePresence>
      </div>
    </div>
  );
}


function ActivityList({ allActivities, activities, currentActivityId, goToActivity }: { allActivities: Activity[], activities: Activity[], currentActivityId: string | null, goToActivity: (id: string) => void }) {
  if (!activities || activities.length === 0) {
      return <div className="text-center text-sm text-muted-foreground p-10">Nenhuma atividade encontrada nesta lista.</div>
  }
  
  const getName = (activity: Activity) => {
    if (activity.parentId) {
      const parent = allActivities.find(a => a.id === activity.parentId);
      if (parent) {
        return `${parent.nome} » ${activity.nome}`;
      }
    }
    return activity.nome;
  }
  
  return (
    <ScrollArea className="h-[calc(100vh-320px)] px-4 sm:px-0 sm:pr-4">
      <ul className="space-y-2">
        {activities.map((act) => (
          <li key={act.id}>
            <button
              onClick={() => goToActivity(act.id)}
              className={cn(
                "w-full text-left p-3 rounded-md transition-colors text-sm flex items-center gap-3",
                act.id === currentActivityId ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
              )}
            >
              <span title={statusLabels[act.status]}>{statusIcons[act.status as keyof typeof statusIcons]}</span>
              <span className="flex-1 truncate">{getName(act)}</span>
              <Badge variant={act.id === currentActivityId ? 'default' : 'secondary'} className="hidden lg:inline-flex">{statusLabels[act.status]}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}

function CommentSheet({activity, newComment, setNewComment, onAddComment, isSaving} : {activity: Activity, newComment: string, setNewComment: (val: string) => void, onAddComment: () => void, isSaving: boolean}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                    <MessageSquare className="mr-2 h-4 w-4"/>
                    Ver / Adicionar Comentários ({activity.comentarios?.length || 0})
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                <SheetTitle>Comentários sobre: {activity.nome}</SheetTitle>
                </SheetHeader>
                <div className="py-4 flex flex-col h-[calc(100%-80px)]">
                    <ScrollArea className="flex-1 pr-4 -mr-6">
                        <div className="space-y-4 ">
                            {activity.comentarios?.length > 0 ? (
                                activity.comentarios.sort((a,b) => {
                                     const dateA = getCommentDate(a);
                                     const dateB = getCommentDate(b);
                                     if (!dateA) return 1;
                                     if (!dateB) return -1;
                                     return dateB.getTime() - dateA.getTime();
                                }).map((c, i) => (
                                    <CommentItem key={i} comment={c} />
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">Nenhum comentário ainda.</p>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex gap-2">
                            <Input 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Adicionar um comentário..."
                                className="text-base"
                                onKeyDown={(e) => e.key === 'Enter' && onAddComment()}
                            />
                            <Button onClick={onAddComment} disabled={!newComment.trim() || isSaving}>Adicionar</Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function SummaryScreen({ stats, onReviewPending, onReviewApproved }: { stats: { approved: number, pending: number, unclassified: number }, onReviewPending: () => void, onReviewApproved: () => void }) {
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
    <div className="max-w-4xl mx-auto text-center py-12">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-5xl font-bold tracking-tight">🎉 Rodada de Classificação Concluída!</h1>
        <p className="mt-4 text-lg text-muted-foreground">Vocês revisaram as atividades pendentes. Veja o resumo:</p>
      
        <div className="grid md:grid-cols-3 gap-4 my-8 text-left">
          <StatCard title="Atividades Aprovadas" value={stats.approved} color="border-green-500" icon={<ThumbsUp className="h-8 w-8 text-green-500" />}/>
          <StatCard title="Aguardando Consenso" value={stats.pending} color="border-yellow-500" icon={<ActivitySquare className="h-8 w-8 text-yellow-500" />}/>
          <StatCard title="Não Classificadas" value={stats.unclassified} color="border-gray-400" icon={<Square className="h-8 w-8 text-gray-400" />}/>
        </div>

        <div className="my-8">
            <div className="flex justify-between mb-1 text-sm text-muted-foreground">
                <span>Progresso Total de Aprovação</span>
                <span>{Math.round(approvedPercentage)}%</span>
            </div>
            <Progress value={approvedPercentage} className="h-3 [&>div]:bg-green-500" />
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button size="lg" className="h-16 text-lg" onClick={onReviewPending} disabled={stats.pending === 0 && stats.unclassified === 0}>
              Revisar Pendentes
          </Button>
           <Button size="lg" variant="outline" className="h-16 text-lg" onClick={onReviewApproved} disabled={stats.approved === 0}>
              Revisar Aprovadas
          </Button>
          <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => router.push('/processflow/dashboard')}>
              Ir para o Dashboard
          </Button>
          <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => router.push('/processflow/brainstorm')}>
              Voltar ao Brainstorm
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
