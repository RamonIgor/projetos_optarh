"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { type Survey, type Client } from '@/types/activity';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, CalendarIcon, Info, ChevronRight, Ban, Building } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const surveyFormSchema = z.object({
  title: z.string().min(3, "O nome da pesquisa é obrigatório e deve ter no mínimo 3 caracteres."),
  description: z.string().optional(),
  opensAt: z.date({ required_error: "A data de início é obrigatória." }),
  closesAt: z.date({ required_error: "A data de término é obrigatória." }),
  isAnonymous: z.boolean().default(true),
}).refine(data => data.closesAt > data.opensAt, {
  message: "A data de término deve ser posterior à data de início.",
  path: ["closesAt"],
});

type SurveyFormValues = z.infer<typeof surveyFormSchema>;


function ClientSelectorForEditor() {
    const { clientId, setSelectedClientId, isConsultant } = useClient();
    const db = useFirestore();
    const { toast } = useToast();

    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !isConsultant) {
            setIsLoading(false);
            return;
        }
        
        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const clientsQuery = query(collection(db, 'clients'), orderBy('name', 'asc'));
                const snapshot = await getDocs(clientsQuery);
                const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(clientsData);
            } catch (error) {
                console.error("Error fetching clients:", error);
                toast({ title: "Erro ao buscar clientes", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();
    }, [db, isConsultant, toast]);

    if (!isConsultant) return null;

    return (
        <Card className="mb-6 bg-muted/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Cliente Alvo da Pesquisa
                </CardTitle>
                <CardDescription>
                    Selecione para qual cliente esta pesquisa será direcionada. Esta ação não poderá ser alterada após o envio da pesquisa.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <Select value={clientId || ''} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder="Selecione um cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clients.length > 0 ? (
                                clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum cliente cadastrado.</div>
                            )}
                        </SelectContent>
                    </Select>
                )}
                 {!clientId && !isLoading && (
                    <p className="text-sm text-destructive mt-2">
                        Por favor, selecione um cliente para habilitar o formulário.
                    </p>
                 )}
            </CardContent>
        </Card>
    );
}

export default function SurveyEditorPage() {
  const { surveyId } = useParams();
  const isNewSurvey = surveyId === 'novo';
  
  const router = useRouter();
  const db = useFirestore();
  const { clientId } = useClient();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(!isNewSurvey);
  const [isSaving, startSaving] = useTransition();

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: {
      title: "",
      description: "",
      isAnonymous: true,
    }
  });

  useEffect(() => {
    if (!isNewSurvey && clientId && db) {
      const fetchSurvey = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const surveyData = docSnap.data() as Survey;
            form.reset({
              ...surveyData,
              opensAt: (surveyData.opensAt as Timestamp).toDate(),
              closesAt: (surveyData.closesAt as Timestamp).toDate(),
            });
          } else {
            toast({ title: "Pesquisa não encontrada", variant: "destructive" });
            router.push('/pulsecheck');
          }
        } catch (error) {
          console.error("Error fetching survey:", error);
          toast({ title: "Erro ao carregar pesquisa", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSurvey();
    } else {
        setIsLoading(false);
    }
  }, [surveyId, clientId, db, router, form, toast, isNewSurvey]);

  const onSubmit = (data: SurveyFormValues) => {
    if (!clientId || !db) {
        toast({ title: "Cliente não identificado. Não é possível salvar.", description: "Por favor, selecione um cliente para continuar.", variant: "destructive" });
        return;
    }

    startSaving(async () => {
      try {
        const idToSave = isNewSurvey ? doc(collection(db, 'clients')).id : surveyId as string;
        const docRef = doc(db, 'clients', clientId, 'surveys', idToSave);

        const surveyData: Partial<Survey> = {
          ...data,
          clientId: clientId,
          status: 'draft',
          questions: [],
        };
        
        if (isNewSurvey) {
            surveyData.createdAt = serverTimestamp();
        }

        await setDoc(docRef, surveyData, { merge: true });

        toast({
          title: "Progresso Salvo!",
          description: "As informações básicas da pesquisa foram salvas.",
        });
        
        router.push(`/pulsecheck/editor/${idToSave}/questions`);

      } catch (error) {
        console.error("Error saving survey:", error);
        toast({ title: "Erro ao salvar pesquisa", description: "Ocorreu um erro ao tentar salvar os dados.", variant: "destructive" });
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

  return (
    <div className="w-full max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl font-bold text-primary tracking-tight">{isNewSurvey ? "Criar Nova Pesquisa" : "Editar Pesquisa"}</h1>
            <p className="mt-2 text-lg text-muted-foreground">Passo 1 de 3: Informações Básicas</p>
        </motion.div>
        
        <div className="mt-8">
            <ClientSelectorForEditor />
        </div>

        <fieldset disabled={!clientId || isSaving} className="disabled:opacity-50">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalhes da Pesquisa</CardTitle>
                            <CardDescription>Defina o nome, a descrição e o período em que a pesquisa ficará ativa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome da Pesquisa</FormLabel>
                                    <FormControl><Input placeholder="Ex: Pesquisa de Clima Organizacional - Q3 2024" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl><Textarea placeholder="Descreva brevemente o objetivo desta pesquisa para os colaboradores." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="grid md:grid-cols-2 gap-8">
                                <FormField control={form.control} name="opensAt" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data de Início</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="closesAt" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data de Término</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Configurações Adicionais</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <FormField control={form.control} name="isAnonymous" render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center space-x-2">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="!mt-0 cursor-pointer">Permitir respostas anônimas</FormLabel>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger type="button"><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                                                <TooltipContent><p>Se marcado, os nomes dos colaboradores não serão vinculados às respostas.</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <FormDescription>Recomendado para pesquisas de clima, para garantir sinceridade nas respostas.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4 justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => router.push('/pulsecheck')}>
                                <Ban className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar e Ir para Perguntas
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </fieldset>
    </div>
  );
}
