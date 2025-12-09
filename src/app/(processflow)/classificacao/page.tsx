"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Loader2, CheckCircle, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';


export default function ClassificationPage() {
  const db = useFirestore();
  const { clientId, isClientLoading, isConsultant } = useClient();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  // Form state
  const [justificativa, setJustificativa] = useState('');
  const [categoria, setCategoria] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [recorrencia, setRecorrencia] = useState('');
  const [comentarios, setComentarios] = useState('');

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
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching activities:", error);
      toast({ title: "Erro ao carregar atividades.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, clientId, user, isLoadingPage, router, toast]);

  const activeActivity = useMemo(() => {
    return activities[current];
  }, [activities, current]);

  useEffect(() => {
    if (!api) return;
    
    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };
    
    api.on("select", handleSelect);
    handleSelect(); // Set initial value

    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  // Update form when active activity changes
  useEffect(() => {
    if (activeActivity) {
      setCategoria(activeActivity.categoria || '');
      setJustificativa(activeActivity.justificativa || '');
      setResponsavel(activeActivity.responsavel || '');
      setRecorrencia(activeActivity.recorrencia || '');
      setComentarios('');
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
        description: `"${activeActivity.nome}" foi atualizada com sucesso.`
      });

      // Move to next if possible
      if (api?.canScrollNext()) {
        api.scrollNext();
      } else {
        // If it was the last one, the list will update and might be empty
        // The useEffect will handle showing the empty state
      }

    } catch (error) {
      console.error("Error updating activity:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const getActivityName = (activity: Activity) => {
    if (activity.parentId) {
        const parent = activities.find(a => a.id === activity.parentId);
        return parent ? `${parent.nome} » ${activity.nome}` : activity.nome;
    }
    return activity.nome;
  };

  const renderContent = () => {
    if (isLoadingPage || isLoading) {
      return <div className="flex justify-center items-center h-96"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    if (activities.length === 0) {
      return (
        <Card className="shadow-lg">
          <CardContent className="text-center py-20">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Tudo em ordem!</h2>
            <p className="mt-2 text-muted-foreground">Não há mais atividades para classificar no momento.</p>
            <Button className="mt-6" onClick={() => router.push('/processflow/brainstorm')}>
              Ir para o Brainstorm
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    if (!activeActivity) return null;

    return (
      <>
        <Carousel setApi={setApi} className="w-full">
            <CarouselContent>
                {activities.map((activity) => (
                    <CarouselItem key={activity.id}>
                      <Card className="border-primary border-2 shadow-lg">
                        <CardHeader>
                          <CardTitle className="text-xl">{getActivityName(activity)}</CardTitle>
                          <CardDescription>
                            Use o formulário abaixo para classificar e detalhar esta atividade.
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
        </Carousel>
        <div className="text-center text-sm text-muted-foreground my-2">
            Atividade {current + 1} de {activities.length}
        </div>

        <Card className="mt-4">
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                
                {/* Coluna 1 */}
                <div className="space-y-6">
                    <div>
                        <Label htmlFor="categoria" className="text-lg font-semibold flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">1</span>
                            Categoria
                        </Label>
                        <Select value={categoria} onValueChange={setCategoria} required>
                            <SelectTrigger id="categoria"><SelectValue placeholder="Selecione a área responsável" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DP">DP</SelectItem>
                                <SelectItem value="RH">RH</SelectItem>
                                <SelectItem value="Compartilhado">Compartilhado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="justificativa" className="text-lg font-semibold flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">2</span>
                            Justificativa
                        </Label>
                        <Textarea id="justificativa" placeholder="Por que esta atividade é importante?" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={8} />
                    </div>
                </div>

                {/* Coluna 2 */}
                <div className="space-y-6">
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

                     {activeActivity.status === 'aguardando_consenso' && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Aguardando Consenso</h4>
                            <p className="text-sm text-yellow-700 mt-1">Esta atividade já foi classificada e aguarda a aprovação final. Você pode revisar ou aprovar diretamente.</p>
                        </div>
                     )}
                </div>
            </div>
            
            <div className="border-t pt-6 mt-6 flex flex-col sm:flex-row justify-end items-center gap-4">
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
      </>
    );
  };

  return (
    <AppLayout>
        <div className="max-w-5xl mx-auto w-full">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl md:text-5xl font-bold text-center text-primary tracking-tight">Classificação de Atividades</h1>
                <p className="mt-4 text-lg text-center text-muted-foreground">Analise, detalhe e priorize as atividades levantadas no brainstorm.</p>
            </motion.div>
            <div className="mt-8">
                {renderContent()}
            </div>
        </div>
    </AppLayout>
  );
}
