"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useClient, useUser } from '@/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { type Activity } from '@/types/activity';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, RotateCcw, AlertTriangle, Info, ListChecks, Building, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

const getActivityName = (activity: Activity, allActivities: Activity[]) => {
    if (activity.parentId) {
        const parent = allActivities.find(a => a.id === activity.parentId);
        return parent ? `${parent.nome} » ${activity.nome}` : activity.nome;
    }
    return activity.nome;
};

function ActivityList({ activities, selectedActivityId, onSelectActivity, allActivities }: { activities: Activity[], selectedActivityId: string | null, onSelectActivity: (id: string) => void, allActivities: Activity[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Pendentes de Classificação
                </CardTitle>
                 <CardDescription>
                    Selecione uma atividade para classificar.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                                    activity.status === 'aguardando_consenso' && 'bg-yellow-200 text-yellow-800'
                                )}>
                                    {activity.status === 'brainstorm' ? 'Não Classificada' : 'Aguardando Consenso'}
                                </Badge>
                            </button>
                        )) : (
                            <div className="text-center py-10">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold">Tudo em ordem!</h3>
                                <p className="text-muted-foreground">Não há atividades para classificar.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default function ClassificationPage() {
  const db = useFirestore();
  const { clientId, isClientLoading } = useClient();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // Form state
  const [justificativa, setJustificativa] = useState('');
  const [categoria, setCategoria] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [recorrencia, setRecorrencia] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  
  const isLoadingPage = userLoading || isClientLoading;

  useEffect(() => {
    if (isLoadingPage) return;
    if (!user) {
        router.push('/login');
        return;
    }
    if (!clientId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'clients', clientId, 'activities'), 
      where('status', 'in', ['brainstorm', 'aguardando_consenso'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      const sorted = activitiesData.sort((a,b) => ((a.createdAt as Timestamp)?.seconds || 0) - ((b.createdAt as Timestamp)?.seconds || 0));
      setActivities(sorted);

      const activityIdFromUrl = searchParams.get('activityId');
      if (activityIdFromUrl && sorted.some(a => a.id === activityIdFromUrl)) {
          setSelectedActivityId(activityIdFromUrl);
      } else if (sorted.length > 0 && !selectedActivityId) {
          setSelectedActivityId(sorted[0].id);
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

  const activeActivity = useMemo(() => {
    return activities.find(a => a.id === selectedActivityId);
  }, [activities, selectedActivityId]);

  useEffect(() => {
    if (activeActivity) {
      setCategoria(activeActivity.categoria || '');
      setJustificativa(activeActivity.justificativa || '');
      setResponsavel(activeActivity.responsavel || '');
      setRecorrencia(activeActivity.recorrencia || '');
    } else {
      // Clear form if no activity is selected
      setCategoria('');
      setJustificativa('');
      setResponsavel('');
      setRecorrencia('');
    }
  }, [activeActivity]);

  const handleUpdate = async (newStatus: 'aguardando_consenso' | 'aprovada') => {
    if (!activeActivity || !clientId) return;

    if (!categoria || !justificativa || !responsavel || !recorrencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Categoria, justificativa, responsável e recorrência são necessários para avançar.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'clients', clientId, 'activities', activeActivity.id);
      
      const updateData: Partial<Activity> = {
        categoria: categoria as Activity['categoria'],
        justificativa,
        responsavel,
        recorrencia: recorrencia as Activity['recorrencia'],
        status: newStatus,
      };

      if (newStatus === 'aprovada') {
        updateData.dataAprovacao = serverTimestamp();
      }

      await updateDoc(docRef, updateData);

      toast({
        title: `Atividade ${newStatus === 'aprovada' ? 'Aprovada' : 'Salva'}!`,
        description: `"${getActivityName(activeActivity, activities)}" foi atualizada com sucesso.`
      });

      // The list will update automatically via onSnapshot
      // The logic to select the next activity is already in the useEffect

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

    if (activities.length === 0) {
      return (
         <div className="col-span-1 md:col-span-3">
             <ActivityList activities={[]} selectedActivityId={null} onSelectActivity={() => {}} allActivities={[]} />
        </div>
      );
    }

    return (
      <>
        <div className="md:col-span-1">
             <ActivityList activities={activities} selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId} allActivities={activities} />
        </div>

        <div className="md:col-span-2">
            {activeActivity ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">{getActivityName(activeActivity, activities)}</CardTitle>
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
                         <RadioGroup value={categoria} onValueChange={(value) => setCategoria(value as any)} className="grid grid-cols-3 gap-4">
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

                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <Label htmlFor="responsavel" className="text-lg font-semibold flex items-center gap-2 mb-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">3</span>
                                Responsável
                            </Label>
                            <Input id="responsavel" placeholder="Quem executará a tarefa?" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="recorrencia" className="text-lg font-semibold flex items-center gap-2 mb-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">4</span>
                                Recorrência
                            </Label>
                            <Select value={recorrencia} onValueChange={setRecorrencia}>
                                <SelectTrigger id="recorrencia"><SelectValue placeholder="Com que frequência ocorre?" /></SelectTrigger>
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
                    
                    {activeActivity.status === 'aguardando_consenso' && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Aguardando Consenso</h4>
                            <p className="text-sm text-yellow-700 mt-1">Esta atividade já foi classificada e aguarda a aprovação final. Você pode revisar ou aprovar diretamente.</p>
                        </div>
                    )}
                    
                    <div className="border-t pt-6 flex flex-col sm:flex-row justify-end items-center gap-4">
                        <Button variant="outline" size="lg" onClick={() => handleUpdate('aguardando_consenso')} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                        Salvar e Mover para Consenso
                        </Button>
                        <Button size="lg" onClick={() => handleUpdate('aprovada')} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        Aprovar Atividade
                        </Button>
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
