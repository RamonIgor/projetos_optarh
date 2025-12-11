
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useClient, useUser } from '@/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { type Activity } from '@/types/activity';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, RotateCcw, AlertTriangle, Info, ListChecks, Building, User, Users, Undo2, Calendar as CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


const getActivityName = (activity: Activity, allActivities: Activity[]) => {
    if (activity.parentId) {
        const parent = allActivities.find(a => a.id === activity.parentId);
        return parent ? `${parent.nome} » ${activity.nome}` : activity.nome;
    }
    return activity.nome;
};

function ActivityList({ title, activities, selectedActivityId, onSelectActivity, allActivities, emptyMessage }: { title: string, activities: Activity[], selectedActivityId: string | null, onSelectActivity: (id: string) => void, allActivities: Activity[], emptyMessage: string }) {
    return (
        <ScrollArea className="h-[60vh]">
             <div className="space-y-2 pr-4">
                {activities.length > 0 ? activities.map(activity => (
                     <button
                        key={activity.id}
                        onClick={() => onSelectActivity(activity.id)}
                        className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            selectedActivityId === activity.id
                                ? "bg-primary/10 border-primary"
                                : "bg-transparent hover:bg-muted"
                        )}
                    >
                        <p className="font-semibold">{getActivityName(activity, allActivities)}</p>
                        <Badge variant="secondary" className={cn(
                            "mt-1",
                            activity.status === 'aguardando_consenso' && 'bg-yellow-200 text-yellow-800',
                            activity.status === 'aprovada' && 'bg-green-200 text-green-800'
                        )}>
                            {activity.status === 'brainstorm' ? 'Não Classificada' : activity.status === 'aguardando_consenso' ? 'Aguardando Consenso' : 'Aprovada'}
                        </Badge>
                    </button>
                )) : (
                    <div className="text-center py-10">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold">{emptyMessage}</h3>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

export default function ClassificationPage() {
  const db = useFirestore();
  const { clientId, isClientLoading } = useClient();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pendentes');

  // Form state
  const [justificativa, setJustificativa] = useState('');
  const [categoria, setCategoria] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [recorrencia, setRecorrencia] = useState('');
  const [prazo, setPrazo] = useState<Date | undefined>();


  const [isSaving, setIsSaving] = useState(false);
  
  const isLoadingPage = userLoading || isClientLoading;

  useEffect(() => {
    if (isLoadingPage) return;
    if (!user) {
        router.push('/login');
        return;
    }
    if (!clientId) {
      setAllActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Query only for main activities (where parentId is null)
    const q = query(
      collection(db, 'clients', clientId, 'activities'),
      where('parentId', '==', null)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      const sorted = activitiesData.sort((a,b) => ((b.createdAt as Timestamp)?.seconds || 0) - ((a.createdAt as Timestamp)?.seconds || 0));
      setAllActivities(sorted);

      const activityIdFromUrl = searchParams.get('activityId');
      if (activityIdFromUrl && sorted.some(a => a.id === activityIdFromUrl)) {
          setSelectedActivityId(activityIdFromUrl);
      } else if (sorted.filter(a => a.status !== 'aprovada').length > 0 && !selectedActivityId) {
          setSelectedActivityId(sorted.filter(a => a.status !== 'aprovada')[0].id);
      } else if (sorted.length === 0) {
          setSelectedActivityId(null);
      }

      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching activities:", error);
      toast({ title: "Erro ao carregar atividades.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, clientId, user, isLoadingPage, router, toast]);

  const pendingActivities = useMemo(() => allActivities.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso'), [allActivities]);
  const approvedActivities = useMemo(() => allActivities.filter(a => a.status === 'aprovada'), [allActivities]);
  
  const activeActivity = useMemo(() => {
    return allActivities.find(a => a.id === selectedActivityId);
  }, [allActivities, selectedActivityId]);

  useEffect(() => {
    if (activeActivity) {
      setCategoria(activeActivity.categoria || '');
      setJustificativa(activeActivity.justificativa || '');
      setResponsavel(activeActivity.responsavel || '');
      setRecorrencia(activeActivity.recorrencia || '');
      setPrazo(activeActivity.prazo ? (activeActivity.prazo as Timestamp).toDate() : undefined);
    } else {
      // Clear form if no activity is selected
      setCategoria('');
      setJustificativa('');
      setResponsavel('');
      setRecorrencia('');
      setPrazo(undefined);
    }
  }, [activeActivity]);

  const handleUpdate = async (newStatus: 'aguardando_consenso' | 'aprovada' | 'brainstorm') => {
    if (!activeActivity || !clientId) return;

    if (newStatus !== 'brainstorm' && (!categoria || !justificativa || !responsavel || !recorrencia)) {
      toast({
        title: "Campos obrigatórios",
        description: "Categoria, justificativa, responsável e recorrência são necessários para avançar.",
        variant: "destructive"
      });
      return;
    }
    
    if (newStatus !== 'brainstorm' && recorrencia === 'Sob demanda' && !prazo) {
        toast({
            title: "Prazo obrigatório",
            description: "Para atividades 'Sob demanda', é necessário definir um prazo de conclusão.",
            variant: "destructive"
        });
        return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'clients', clientId, 'activities', activeActivity.id);
      
      const updateData: Partial<Activity> & { [key: string]: any } = {
        categoria: categoria as Activity['categoria'],
        justificativa,
        responsavel,
        recorrencia: recorrencia as Activity['recorrencia'],
        status: newStatus,
        dataAprovacao: newStatus === 'aprovada' ? serverTimestamp() : null,
        prazo: recorrencia === 'Sob demanda' ? prazo : null,
      };

      await updateDoc(docRef, updateData);

      let toastTitle = '';
      if(newStatus === 'aprovada') toastTitle = 'Atividade Aprovada!';
      else if (newStatus === 'aguardando_consenso') toastTitle = 'Atividade Salva!';
      else if (newStatus === 'brainstorm') toastTitle = 'Atividade Revertida!';

      toast({
        title: toastTitle,
        description: `"${getActivityName(activeActivity, allActivities)}" foi atualizada com sucesso.`
      });
      
      if(newStatus === 'brainstorm'){
          setActiveTab('pendentes');
      }

    } catch (error) {
      console.error("Error updating activity:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  

  const renderContent = () => {
    if (isLoadingPage || isLoading) {
      return <div className="flex justify-center items-center h-96 col-span-3"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
      <>
        <div className="md:col-span-1">
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="p-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pendentes">Pendentes ({pendingActivities.length})</TabsTrigger>
                    <TabsTrigger value="aprovadas">Aprovadas ({approvedActivities.length})</TabsTrigger>
                  </TabsList>
              </CardHeader>
              <CardContent className="p-3">
                <TabsContent value="pendentes">
                  <ActivityList
                    title="Pendentes"
                    activities={pendingActivities}
                    selectedActivityId={selectedActivityId}
                    onSelectActivity={setSelectedActivityId}
                    allActivities={allActivities}
                    emptyMessage="Nenhuma atividade pendente!"
                  />
                </TabsContent>
                <TabsContent value="aprovadas">
                  <ActivityList
                    title="Aprovadas"
                    activities={approvedActivities}
                    selectedActivityId={selectedActivityId}
                    onSelectActivity={setSelectedActivityId}
                    allActivities={allActivities}
                    emptyMessage="Nenhuma atividade aprovada ainda."
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div className="md:col-span-2">
            {activeActivity ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">{getActivityName(activeActivity, allActivities)}</CardTitle>
                        <CardDescription>
                            Use o formulário abaixo para classificar e detalhar esta atividade.
                        </CardDescription>
                    </CardHeader>
                <CardContent className="space-y-8">
                     <div>
                        <Label className="text-lg font-semibold flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">1</span>
                            Categoria
                        </Label>
                         <RadioGroup value={categoria} onValueChange={(value) => setCategoria(value as any)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <RadioGroupItem value="DP" id="cat-dp" className="sr-only" />
                                <Label htmlFor="cat-dp" className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent cursor-pointer", categoria === 'DP' && 'border-primary bg-primary/10')}>
                                    <Building className="mb-3 h-6 w-6" /> DP
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="RH" id="cat-rh" className="sr-only" />
                                <Label htmlFor="cat-rh" className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent cursor-pointer", categoria === 'RH' && 'border-primary bg-primary/10')}>
                                    <User className="mb-3 h-6 w-6" /> RH
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="Compartilhado" id="cat-comp" className="sr-only" />
                                <Label htmlFor="cat-comp" className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent cursor-pointer", categoria === 'Compartilhado' && 'border-primary bg-primary/10')}>
                                    <Users className="mb-3 h-6 w-6" /> Compartilhado
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div>
                        <Label htmlFor="justificativa" className="text-lg font-semibold flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">2</span>
                            Justificativa
                        </Label>
                        <Textarea id="justificativa" placeholder="Por que esta atividade é importante e qual o impacto dela?" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={5} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 items-end">
                        <div>
                            <Label htmlFor="responsavel" className="text-lg font-semibold flex items-center gap-2 mb-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">3</span>
                                Responsável
                            </Label>
                            <Input id="responsavel" placeholder="Quem executará a tarefa?" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-lg font-semibold flex items-center gap-2 mb-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">4</span>
                                Recorrência
                            </Label>
                            <Select value={recorrencia} onValueChange={setRecorrencia}>
                                <SelectTrigger><SelectValue placeholder="Com que frequência ocorre?" /></SelectTrigger>
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
                         {recorrencia === 'Sob demanda' && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                className="md:col-span-2"
                            >
                                <Label className="text-lg font-semibold flex items-center gap-2 mb-2">
                                     <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">5</span>
                                    Prazo de Conclusão (Obrigatório)
                                </Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !prazo && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {prazo ? format(prazo, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={prazo} onSelect={setPrazo} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </motion.div>
                        )}
                    </div>
                    
                    {activeActivity.status === 'aguardando_consenso' && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Aguardando Consenso</h4>
                            <p className="text-sm text-yellow-700 mt-1">Esta atividade já foi classificada e aguarda a aprovação final. Você pode revisar ou aprovar diretamente.</p>
                        </div>
                    )}

                    {activeActivity.status === 'aprovada' && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-green-800 flex items-center gap-2"><CheckCircle className="h-5 w-5"/>Atividade Aprovada</h4>
                            <p className="text-sm text-green-700 mt-1">Esta atividade já foi aprovada. As alterações aqui serão salvas, mas não mudarão o status. Para reclassificar, reverta para brainstorm.</p>
                        </div>
                    )}
                    
                    <div className="border-t pt-6 flex flex-col sm:flex-row justify-end items-center gap-4">
                        {activeActivity.status === 'aprovada' ? (
                            <Button variant="destructive" size="lg" onClick={() => handleUpdate('brainstorm')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Undo2 className="mr-2 h-4 w-4"/>}
                                Reverter para Brainstorm
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" size="lg" onClick={() => handleUpdate('aguardando_consenso')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                                Salvar e Mover para Consenso
                                </Button>
                                <Button size="lg" onClick={() => handleUpdate('aprovada')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                Aprovar Atividade
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
                </Card>
            ) : (
                 <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed">
                     <p className="text-muted-foreground">Selecione uma atividade para começar</p>
                 </div>
            )}
        </div>
      </>
    );
  };

  return (
    <div className="w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Classificação de Atividades</h1>
            <p className="mt-4 text-lg text-muted-foreground">Analise, detalhe e priorize as atividades levantadas no brainstorm.</p>
        </motion.div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {renderContent()}
        </div>
    </div>
  );
}

    