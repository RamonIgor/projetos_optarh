"use client";

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, collection } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { type Survey } from '@/types/activity';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, CalendarIcon, Info, ChevronRight, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Placeholder de departamentos - isso viria do DB em um app real
const allDepartments = [
  "Engenharia", "Marketing", "Vendas", "RH", "Financeiro", "Operações"
];


const surveyFormSchema = z.object({
  title: z.string().min(3, "O nome da pesquisa é obrigatório e deve ter no mínimo 3 caracteres."),
  description: z.string().optional(),
  opensAt: z.date({ required_error: "A data de início é obrigatória." }),
  closesAt: z.date({ required_error: "A data de término é obrigatória." }),
  isAnonymous: z.boolean().default(true),
  targetAudience: z.enum(["all", "specific"]).default("all"),
  targetDepartments: z.array(z.string()).optional(),
  sendReminders: z.boolean().default(false),
  reminderFrequency: z.number().optional(),
}).refine(data => data.closesAt > data.opensAt, {
  message: "A data de término deve ser posterior à data de início.",
  path: ["closesAt"],
}).refine(data => {
    if (data.targetAudience === 'specific') {
        return data.targetDepartments && data.targetDepartments.length > 0;
    }
    return true;
}, {
    message: "Selecione pelo menos um departamento.",
    path: ["targetDepartments"],
});

type SurveyFormValues = z.infer<typeof surveyFormSchema>;

export default function SurveyEditorPage() {
  const { surveyId } = useParams();
  const isNewSurvey = surveyId === 'novo';
  
  const router = useRouter();
  const db = useFirestore();
  const { clientId, selectedClientId, isConsultant } = useClient();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(!isNewSurvey);
  const [isSaving, startSaving] = useTransition();

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: {
      title: "",
      description: "",
      isAnonymous: true,
      targetAudience: "all",
      targetDepartments: [],
      sendReminders: false,
    }
  });

  const effectiveClientId = isConsultant ? selectedClientId : clientId;

  useEffect(() => {
    if (!isNewSurvey && effectiveClientId && db) {
      const fetchSurvey = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'clients', effectiveClientId, 'surveys', surveyId as string);
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
    }
  }, [surveyId, effectiveClientId, db, router, form, toast, isNewSurvey]);

  const onSubmit = (data: SurveyFormValues) => {
    if (!effectiveClientId || !db) {
        toast({ title: "Cliente não identificado. Não é possível salvar.", variant: "destructive" });
        return;
    }

    startSaving(async () => {
      try {
        const idToSave = isNewSurvey ? doc(collection(db, 'clients')).id : surveyId as string;
        const docRef = doc(db, 'clients', effectiveClientId, 'surveys', idToSave);

        const surveyData: Partial<Survey> = {
          ...data,
          clientId: effectiveClientId,
          status: 'draft', // Sempre salva como rascunho no passo 1
          questionIds: [], // Será preenchido no passo 2
        };
        
        if (isNewSurvey) {
            surveyData.createdAt = serverTimestamp();
        }

        await setDoc(docRef, surveyData, { merge: true });

        toast({
          title: "Progresso Salvo!",
          description: "As informações básicas da pesquisa foram salvas como rascunho.",
        });

        // Navega para o passo 2 (a ser criado)
        // router.push(`/pulsecheck/editor/${idToSave}/perguntas`);
        // Por enquanto, vamos apenas mostrar um toast de sucesso e ficar na página
         toast({
          title: "Próximo Passo (Em Breve)",
          description: "A navegação para a configuração de perguntas será implementada aqui.",
        });

      } catch (error) {
        console.error("Error saving survey:", error);
        toast({ title: "Erro ao salvar pesquisa", description: "Ocorreu um erro ao tentar salvar os dados.", variant: "destructive" });
      }
    });
  };

  if (isLoading && !isNewSurvey) {
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
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="mt-8">
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
                        
                        <FormField control={form.control} name="sendReminders" render={({ field }) => (
                             <FormItem>
                                <div className="flex items-center space-x-2">
                                     <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel className="!mt-0 cursor-pointer">Enviar lembretes automáticos</FormLabel>
                                </div>
                                <FormDescription>O sistema enviará e-mails para os colaboradores que ainda não responderam.</FormDescription>
                                {field.value && (
                                    <motion.div initial={{opacity:0, height: 0}} animate={{opacity:1, height: 'auto'}} className="mt-4 pl-6">
                                        <div className="flex items-center gap-2">
                                            <FormLabel>A cada</FormLabel>
                                            <FormField control={form.control} name="reminderFrequency" render={({ field: reminderField }) => (
                                                <Input type="number" className="w-20" placeholder="Ex: 3" {...reminderField} onChange={e => reminderField.onChange(parseInt(e.target.value, 10) || undefined)} />
                                            )} />
                                            <FormLabel>dias.</FormLabel>
                                        </div>
                                    </motion.div>
                                )}
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
                            Próximo: Configurar Perguntas
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    </div>
  );
}
