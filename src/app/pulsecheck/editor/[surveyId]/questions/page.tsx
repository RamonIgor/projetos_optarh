"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { type Survey, type Question, type SelectedQuestion } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { motion } from 'framer-motion';

import { QuestionLibrary } from './_components/QuestionLibrary';
import { SelectedQuestions } from './_components/SelectedQuestions';
import { QuestionBuilderDialog } from './_components/QuestionBuilderDialog';

export default function ConfigureQuestionsPage() {
    const { surveyId } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { clientId } = useClient();
    const { toast } = useToast();

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [libraryQuestions, setLibraryQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [questionToEdit, setQuestionToEdit] = useState<SelectedQuestion | null>(null);

    // Fetch Survey and Library Questions
    useEffect(() => {
        if (!clientId || !db) return;

        // Fetch survey data
        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
        const unsubscribeSurvey = onSnapshot(surveyDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const surveyData = { id: docSnap.id, ...docSnap.data() } as Survey;
                setSurvey(surveyData);
                setSelectedQuestions(surveyData.questions || []);
                setIsLoading(false);
            } else {
                toast({ title: "Pesquisa não encontrada", variant: "destructive" });
                router.push('/pulsecheck');
            }
        });

        // Fetch library questions
        const questionsQuery = query(collection(db, 'pulse_check_questions'), orderBy('order'));
        const unsubscribeLibrary = onSnapshot(questionsQuery, (snapshot) => {
            const questionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            setLibraryQuestions(questionsData);
        });

        return () => {
            unsubscribeSurvey();
            unsubscribeLibrary();
        };

    }, [surveyId, clientId, db, router, toast]);

    const updateSurveyQuestions = async (newQuestions: SelectedQuestion[]) => {
        if (!clientId || !db) return;
        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
        await updateDoc(surveyDocRef, { questions: newQuestions });
    };

    const handleAddQuestion = (question: Question) => {
        const newQuestion: SelectedQuestion = {
            id: `${question.id}-${Date.now()}`, // Create a unique ID for the list
            questionId: question.id,
            text: question.text,
            type: question.type,
            category: question.category,
            options: question.type === 'multiple-choice' ? question.options || [] : null,
            isMandatory: question.isMandatory
        };
        const newQuestions = [...selectedQuestions, newQuestion];
        setSelectedQuestions(newQuestions);
    };
    
    const handleRemoveQuestion = (idToRemove: string) => {
        const newQuestions = selectedQuestions.filter(q => q.id !== idToRemove);
        setSelectedQuestions(newQuestions);
    };

    const handleReorderQuestions = (startIndex: number, endIndex: number) => {
        const result = Array.from(selectedQuestions);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        setSelectedQuestions(result);
    };

    const handleUpdateQuestion = (id: string, updates: Partial<SelectedQuestion>) => {
        const newQuestions = selectedQuestions.map(q => q.id === id ? { ...q, ...updates } : q);
        setSelectedQuestions(newQuestions);
    };

    const handleOpenBuilderForEdit = (question: SelectedQuestion) => {
        setQuestionToEdit(question);
        setIsBuilderOpen(true);
    };
    
    const handleOpenBuilderForCreate = () => {
        setQuestionToEdit(null);
        setIsBuilderOpen(true);
    };

    const handleSaveFromBuilder = (questionData: Omit<SelectedQuestion, 'id'>) => {
        const finalQuestionData: Omit<SelectedQuestion, 'id'> = {
            ...questionData,
            options:
              questionData.type === 'multiple-choice'
                ? (questionData.options || []).map(opt => typeof opt === 'object' ? (opt as any).value : opt)
                : null,
          };

        // If we are editing
        if (questionToEdit) {
            const updatedQuestions = selectedQuestions.map(q => 
                q.id === questionToEdit.id ? { ...q, ...finalQuestionData, id: q.id } as SelectedQuestion : q
            );
            setSelectedQuestions(updatedQuestions);
        } else { // If we are creating a new one
            const newCustomQuestion: SelectedQuestion = {
                id: `custom-${Date.now()}`,
                ...finalQuestionData,
            };
            setSelectedQuestions([...selectedQuestions, newCustomQuestion]);
        }
    };
    
    const handleSaveChanges = async () => {
         await updateSurveyQuestions(selectedQuestions);
         toast({ title: "Alterações salvas!", description: "A lista de perguntas foi atualizada."});
    };
    
    const handlePublish = async () => {
        if(selectedQuestions.length === 0) {
            toast({ title: "Nenhuma pergunta selecionada", description: "Adicione ao menos uma pergunta para publicar.", variant: "destructive"});
            return;
        }
        await updateSurveyQuestions(selectedQuestions);
        
        // In a real scenario, you'd navigate to a "Review and Publish" (Step 3) screen.
        // For now, we'll just show a toast.
        toast({ title: "Pesquisa Pronta para Publicar!", description: "O próximo passo seria revisar e enviar."});
        router.push('/pulsecheck');
    };

    const allCategories = useMemo(() => 
        Array.from(new Set(libraryQuestions.map(q => q.category))),
    [libraryQuestions]);

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
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push(`/pulsecheck/editor/${surveyId}`)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar
                        </Button>
                        <Button onClick={handlePublish}>
                            <Send className="mr-2 h-4 w-4" />
                            Salvar e Publicar
                        </Button>
                    </div>
                </div>
            </motion.div>
            
            <div className="mt-8 grid md:grid-cols-12 gap-6 flex-grow min-h-0">
                <div className="md:col-span-4 lg:col-span-3 h-full">
                    <QuestionLibrary
                        libraryQuestions={libraryQuestions}
                        selectedQuestions={selectedQuestions}
                        onAdd={handleAddQuestion}
                        onCreateCustom={handleOpenBuilderForCreate}
                    />
                </div>
                <div className="md:col-span-8 lg:col-span-9 h-full">
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
                questionToEdit={questionToEdit}
                allCategories={allCategories}
            />
        </div>
    );
}
