
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, serverTimestamp, getDocs, addDoc, where, deleteDoc } from 'firebase/firestore';
import { useFirestore, useClient, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { type Survey, type Question, type SelectedQuestion, type Client } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

import { QuestionLibrary } from './_components/QuestionLibrary';
import { SelectedQuestions } from './_components/SelectedQuestions';
import { QuestionBuilderDialog, type QuestionBuilderFormValues } from './_components/QuestionBuilderDialog';
import { ImportQuestionsDialog } from './_components/ImportQuestionsDialog';

export default function ConfigureQuestionsPage() {
    const { surveyId } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { user } = useUser();
    const { clientId } = useClient();
    const { toast } = useToast();

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [libraryQuestions, setLibraryQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [questionToEdit, setQuestionToEdit] = useState<SelectedQuestion | null>(null);

    // Fetch Survey, Client, and Library Questions
    useEffect(() => {
        if (!clientId || !db) return;

        let unsubSurvey: () => void | undefined;
        let unsubClient: () => void | undefined;
        let unsubClientLibrary: () => void | undefined;
        let unsubGlobalLibrary: () => void | undefined;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch survey data
                const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
                unsubSurvey = onSnapshot(surveyDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const surveyData = { id: docSnap.id, ...docSnap.data() } as Survey;
                        setSurvey(surveyData);
                        setSelectedQuestions(surveyData.questions || []);
                    } else {
                        toast({ title: "Pesquisa não encontrada", variant: "destructive" });
                        router.push('/pulsecheck');
                    }
                });

                // Fetch client data
                const clientDocRef = doc(db, 'clients', clientId);
                unsubClient = onSnapshot(clientDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setClient({ id: docSnap.id, ...docSnap.data() } as Client);
                    }
                });

                // Set up two listeners for questions: one for global, one for client-specific
                const questionsRef = collection(db, 'pulse_check_questions');
                
                const globalQuery = query(questionsRef, where('clientId', '==', null));
                unsubGlobalLibrary = onSnapshot(globalQuery, (snapshot) => {
                    const globalQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question));
                    setLibraryQuestions(prev => {
                        const clientSpecific = prev.filter(q => q.clientId === clientId);
                        return [...globalQuestions, ...clientSpecific].sort((a,b) => a.order - b.order);
                    });
                });
                
                const clientQuery = query(questionsRef, where('clientId', '==', clientId));
                unsubClientLibrary = onSnapshot(clientQuery, (snapshot) => {
                    const clientQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question));
                     setLibraryQuestions(prev => {
                        const global = prev.filter(q => q.clientId === null || q.clientId === undefined);
                        return [...global, ...clientQuestions].sort((a,b) => a.order - b.order);
                    });
                });

            } catch (error) {
                 console.error("Error fetching initial data:", error);
                 toast({ title: "Erro ao carregar dados da biblioteca", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        return () => {
            unsubSurvey?.();
            unsubClient?.();
            unsubClientLibrary?.();
            unsubGlobalLibrary?.();
        };

    }, [surveyId, clientId, db, router, toast]);

    const updateSurveyQuestions = useCallback(async (newQuestions: SelectedQuestion[]) => {
        if (!clientId || !db) return;
        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
        try {
            await updateDoc(surveyDocRef, { questions: newQuestions });
        } catch (error) {
            console.error("Error updating survey questions: ", error);
            toast({ title: "Erro ao salvar", description: "Não foi possível salvar as alterações no banco de dados.", variant: "destructive"});
        }
    }, [clientId, db, surveyId, toast]);

    const handleAddQuestion = useCallback(async (question: Question) => {
        let questionText = question.text;
        if (client?.name && question.text.includes('[EMPRESA]')) {
            questionText = question.text.replace(/\[EMPRESA\]/g, client.name);
        }

        const newQuestion: SelectedQuestion = {
            id: uuidv4(),
            questionId: question.id,
            text: questionText,
            type: question.type,
            category: question.category,
            options: question.type === 'multiple-choice' ? (question.options || []) : null,
            isMandatory: question.isMandatory
        };
        const newQuestions = [...selectedQuestions, newQuestion];
        setSelectedQuestions(newQuestions);
        await updateSurveyQuestions(newQuestions);
        toast({ title: "Pergunta adicionada!", duration: 2000 });
    }, [selectedQuestions, updateSurveyQuestions, toast, client]);
    
    const handleRemoveQuestion = useCallback(async (idToRemove: string) => {
        const newQuestions = selectedQuestions.filter(q => q.id !== idToRemove);
        setSelectedQuestions(newQuestions);
        await updateSurveyQuestions(newQuestions);
        toast({ title: "Pergunta removida.", duration: 2000 });
    }, [selectedQuestions, updateSurveyQuestions, toast]);

    const handleReorderQuestions = useCallback(async (startIndex: number, endIndex: number) => {
        const result = Array.from(selectedQuestions);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        setSelectedQuestions(result);
        await updateSurveyQuestions(result);
        toast({ title: "Ordem das perguntas atualizada.", duration: 2000 });
    }, [selectedQuestions, updateSurveyQuestions, toast]);

    const handleUpdateQuestion = useCallback(async (id: string, updates: Partial<SelectedQuestion>) => {
        const newQuestions = selectedQuestions.map(q => q.id === id ? { ...q, ...updates } : q);
        setSelectedQuestions(newQuestions);
        await updateSurveyQuestions(newQuestions);
    }, [selectedQuestions, updateSurveyQuestions]);

    const handleOpenBuilderForEdit = (question: SelectedQuestion) => {
        if (question.questionId !== 'custom') {
            const originalQuestion = libraryQuestions.find(libQ => libQ.id === question.questionId);
             if (originalQuestion) {
                setQuestionToEdit(originalQuestion as any);
             } else {
                 toast({ title: "Não é possível editar esta pergunta", description: "A pergunta original não foi encontrada na biblioteca.", variant: "destructive"});
                 return;
             }
        } else {
             setQuestionToEdit(question);
        }
        setIsBuilderOpen(true);
    };

    const handleSaveFromBuilder = useCallback(async (formData: QuestionBuilderFormValues) => {
        if (!user || !db || !clientId) return;
        
        const finalCategory = formData.category === 'new' ? formData.newCategory! : formData.category;

        try {
            const newQuestionData = {
                text: formData.text,
                type: formData.type,
                category: finalCategory,
                isMandatory: formData.isMandatory,
                options: formData.type === 'multiple-choice' ? formData.options?.map(o => o.value) : null,
                isDefault: false,
                createdBy: user.uid,
                clientId: clientId, // Link question to the current client
                createdAt: serverTimestamp(),
                order: (libraryQuestions.length + 1) * 10,
                isNpsQuestion: formData.type === 'nps' && finalCategory.toUpperCase() === 'ENPS',
            };
            
            const docRef = await addDoc(collection(db, 'pulse_check_questions'), newQuestionData);
            
            toast({
                title: "Pergunta Adicionada à Biblioteca do Cliente!",
                description: `Sua nova pergunta está agora disponível para este cliente.`,
            });
            
            await handleAddQuestion({ id: docRef.id, ...newQuestionData } as Question);

            setIsBuilderOpen(false);

        } catch (error) {
            console.error("Error saving new question:", error);
            toast({ title: "Erro ao Salvar Pergunta", variant: "destructive" });
        }
    }, [user, db, libraryQuestions.length, toast, handleAddQuestion, clientId]);
    
    const handleDeleteFromLibrary = useCallback(async (questionId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, 'pulse_check_questions', questionId));
            toast({ title: "Pergunta excluída da biblioteca."});
        } catch (error) {
            console.error("Error deleting question from library:", error);
            toast({ title: "Erro ao excluir pergunta", variant: 'destructive'});
        }
    }, [db, toast]);

    const handleSaveFromImporter = useCallback(async (importedQuestions: Omit<SelectedQuestion, 'id' | 'questionId'>[]) => {
        if (!user || !db || !clientId) {
            toast({ title: "Não é possível importar", description: "Usuário ou cliente não identificado.", variant: "destructive" });
            return;
        }

        const questionsCollection = collection(db, 'pulse_check_questions');
        let addedCount = 0;
        
        const promises = importedQuestions.map(q => {
            const questionData = {
                text: q.text,
                type: q.type,
                category: q.category,
                isMandatory: q.isMandatory,
                options: q.options || null,
                isDefault: false,
                createdBy: user.uid,
                clientId: clientId, // Link to current client
                createdAt: serverTimestamp(),
                order: (libraryQuestions.length + addedCount + 1) * 10,
                isNpsQuestion: q.type === 'nps' && q.category.toUpperCase() === 'ENPS',
            };
            addedCount++;
            return addDoc(questionsCollection, questionData);
        });

        try {
            await Promise.all(promises);
            toast({
                title: `${addedCount} perguntas importadas!`,
                description: "As novas perguntas foram adicionadas à biblioteca deste cliente.",
                duration: 4000
            });
            setIsImporterOpen(false);
        } catch (error) {
            console.error("Error importing questions to library:", error);
            toast({ title: "Erro ao importar", description: "Não foi possível salvar as perguntas na biblioteca.", variant: "destructive"});
        }

    }, [user, db, clientId, libraryQuestions.length, toast]);
    
    const handleExportLibrary = () => {
        if (libraryQuestions.length === 0) {
            toast({ title: "Biblioteca vazia", description: "Não há perguntas para exportar.", variant: 'default' });
            return;
        }

        const dataToExport = libraryQuestions.map(q => ({
            Texto: q.text,
            Categoria: q.category,
            Tipo: q.type,
            Opcoes: q.options ? q.options.join('|') : '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Biblioteca de Perguntas");

        XLSX.writeFile(workbook, "OptaRH_Biblioteca_PulseCheck.xlsx");
        
        toast({ title: "Exportação iniciada!", description: "Seu arquivo será baixado em breve." });
    };

    const handleNextStep = () => {
        if(selectedQuestions.length === 0) {
            toast({ title: "Nenhuma pergunta selecionada", description: "Adicione ao menos uma pergunta para continuar.", variant: "destructive"});
            return;
        }
        router.push(`/pulsecheck/editor/${surveyId}/review`);
    };

    const allCategories = useMemo(() => {
        const categories = new Set(libraryQuestions.map(q => q.category));
        return Array.from(categories).sort();
    }, [libraryQuestions]);


    if (isLoading) {
        return (
          <div className="flex items-center justify-center min-h-[60vh] w-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        );
    }

    return (
        <div className="w-full flex flex-col flex-grow">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold text-primary tracking-tight">Configurar Perguntas</h1>
                        <p className="mt-2 text-lg text-muted-foreground">Passo 2 de 3: Monte sua pesquisa</p>
                    </div>
                     <Button onClick={handleNextStep}>
                        Revisar e Publicar
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </motion.div>
            
            <div className="mt-8 grid md:grid-cols-12 gap-6 flex-grow min-h-0">
                <div className="md:col-span-5 lg:col-span-4 h-full flex flex-col">
                    <QuestionLibrary
                        libraryQuestions={libraryQuestions}
                        selectedQuestions={selectedQuestions}
                        onAdd={handleAddQuestion}
                        onAddNew={() => { setQuestionToEdit(null); setIsBuilderOpen(true); }}
                        onImport={() => setIsImporterOpen(true)}
                        onExport={handleExportLibrary}
                        onDeleteFromLibrary={handleDeleteFromLibrary}
                    />
                </div>
                <div className="md:col-span-7 lg:col-span-8 h-full flex flex-col">
                    <SelectedQuestions
                        questions={selectedQuestions}
                        onReorder={handleReorderQuestions}
                        onUpdate={handleUpdateQuestion}
                        onRemove={handleRemoveQuestion}
                        onEdit={handleOpenBuilderForEdit}
                    />
                </div>
            </div>

            <QuestionBuilderDialog
                isOpen={isBuilderOpen}
                onOpenChange={setIsBuilderOpen}
                onSave={handleSaveFromBuilder}
                allCategories={allCategories}
            />

            <ImportQuestionsDialog
                isOpen={isImporterOpen}
                onOpenChange={setIsImporterOpen}
                onImport={handleSaveFromImporter}
            />
        </div>
    );
}
