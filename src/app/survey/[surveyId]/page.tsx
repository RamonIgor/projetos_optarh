
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, collectionGroup } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { type Survey, type Client, type SelectedQuestion, type Response as SurveyResponse } from '@/types/activity';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, ArrowRight, Send, AlertTriangle } from 'lucide-react';
import { NpsQuestion } from './_components/NpsQuestion';
import { LikertQuestion } from './_components/LikertQuestion';
import { MultipleChoiceQuestion } from './_components/MultipleChoiceQuestion';
import { OpenTextQuestion } from './_components/OpenTextQuestion';
import { ThankYouScreen } from './_components/ThankYouScreen';


export default function SurveyResponsePage() {
  const { surveyId: publicId } = useParams();
  const db = useFirestore();
  const { toast } = useToast();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [clientId, surveyId] = useMemo(() => {
    const idString = Array.isArray(publicId) ? publicId[0] : publicId;
    const parts = idString.split('_');
    if (parts.length < 2) return [null, null];
    return [parts[0], parts.slice(1).join('_')];
  }, [publicId]);

  useEffect(() => {
    if (!surveyId) return;

    const submissionStatus = localStorage.getItem(`survey_status_${surveyId}`);
    if (submissionStatus === 'completed') {
      setHasSubmitted(true);
      setIsLoading(false);
      return;
    }

    if (!db || !clientId) {
      setError("Link de pesquisa inválido ou corrompido.");
      setIsLoading(false);
      return;
    }
    
    const fetchSurveyData = async () => {
      try {
        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId);
        const surveyDocSnap = await getDoc(surveyDocRef);
        
        if (surveyDocSnap.exists()) {
            const foundSurvey = { id: surveyDocSnap.id, ...surveyDocSnap.data() } as Survey;
            if (foundSurvey.status !== 'active' || new Date() > (foundSurvey.closesAt as Timestamp).toDate()) {
                 setError('Esta pesquisa não está mais ativa.');
                 setIsLoading(false);
                 return;
            }
            setSurvey(foundSurvey);

            // Fetch client data
            const clientDocRef = doc(db, 'clients', foundSurvey.clientId);
            const clientDocSnap = await getDoc(clientDocRef);
            if (clientDocSnap.exists()) {
                setClient({ id: clientDocSnap.id, ...clientDocSnap.data() } as Client);
            }

            // Load answers from localStorage
            const savedAnswers = localStorage.getItem(`survey_answers_${surveyId}`);
            if (savedAnswers) {
                setAnswers(JSON.parse(savedAnswers));
            }

        } else {
            setError('Pesquisa não encontrada ou você não tem permissão para acessá-la.');
        }
      } catch (err) {
        console.error("Error fetching survey data:", err);
        setError('Ocorreu um erro ao carregar a pesquisa.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveyData();
  }, [db, surveyId, clientId]);

  const handleAnswer = (questionId: string, value: string | number) => {
    if (!surveyId) return;
    setValidationError(null);
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    // Save to localStorage
    localStorage.setItem(`survey_answers_${surveyId}`, JSON.stringify(newAnswers));
  };
  
  const currentQuestion: SelectedQuestion | undefined = survey?.questions[currentStep];

  const renderQuestion = (question: SelectedQuestion) => {
    const commonProps = {
      questionId: question.id,
      currentAnswer: answers[question.id],
    };
    
    if (question.type === 'multiple-choice' && (!question.options || question.options.length === 0)) {
        return <OpenTextQuestion {...commonProps} onAnswer={(value) => handleAnswer(question.id, value)} />;
    }

    switch (question.type) {
      case 'nps':
        return <NpsQuestion {...commonProps} onAnswer={(value) => handleAnswer(question.id, value)} />;
      case 'likert':
        return <LikertQuestion {...commonProps} onAnswer={(value) => handleAnswer(question.id, value)} />;
      case 'multiple-choice':
        return <MultipleChoiceQuestion {...commonProps} options={question.options || []} onAnswer={(value) => handleAnswer(question.id, value)} />;
      case 'open-text':
        return <OpenTextQuestion {...commonProps} onAnswer={(value) => handleAnswer(question.id, value)} />;
      default:
        return <p>Tipo de pergunta não suportado.</p>;
    }
  };

  const handleNext = () => {
    if (currentQuestion && currentQuestion.isMandatory && (answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === '')) {
        setValidationError("Esta pergunta é obrigatória.");
        return;
    }
    setValidationError(null);
    if (currentStep < (survey?.questions.length || 0) - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setValidationError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleSubmit = async () => {
     if (currentQuestion && currentQuestion.isMandatory && (answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === '')) {
        setValidationError("Esta pergunta é obrigatória.");
        return;
    }
    setValidationError(null);
    
    // Final validation
    for(const q of survey?.questions || []) {
        if(q.isMandatory && (answers[q.id] === undefined || answers[q.id] === '')) {
            const qIndex = survey!.questions.findIndex(sq => sq.id === q.id);
            setCurrentStep(qIndex);
            setValidationError("Por favor, responda a esta pergunta obrigatória antes de enviar.");
            return;
        }
    }

    setIsSubmitting(true);
    try {
        const responseData: Omit<SurveyResponse, 'id'> = {
            surveyId: survey!.id,
            clientId: client!.id,
            respondentId: null, // For now, only anonymous
            answers: Object.entries(answers).reduce((acc, [questionId, answer]) => {
                const question = survey?.questions.find(q => q.id === questionId);
                if (question) {
                    acc[questionId] = {
                        questionText: question.text,
                        answer: answer
                    };
                }
                return acc;
            }, {} as Record<string, { questionText: string; answer: string | number; }>),
            submittedAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'pulse_check_responses'), responseData);
        setHasSubmitted(true);
        if (surveyId) {
            localStorage.setItem(`survey_status_${surveyId}`, 'completed');
            localStorage.removeItem(`survey_answers_${surveyId}`);
        }

    } catch (error) {
        console.error("Error submitting response:", error);
        toast({
            title: "Erro ao Enviar",
            description: "Não foi possível enviar suas respostas. Tente novamente.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (hasSubmitted) {
      return <ThankYouScreen />;
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
             <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                    <AlertTriangle className="h-8 w-8" />
                    Acesso Inválido
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg">{error}</p>
            </CardContent>
        </Card>
    </div>;
  }
  
  if (!survey) return null;

  const progress = ((currentStep + 1) / survey.questions.length) * 100;
  const isLastStep = currentStep === survey.questions.length - 1;
  
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-muted/40 p-4 sm:p-6">
        <header className="w-full max-w-4xl">
             {client?.logoUrl && (
                 <div className="mb-4 text-center">
                    <Image src={client.logoUrl} alt={`${client.name} Logo`} width={150} height={50} className="mx-auto" unoptimized/>
                 </div>
             )}
            <h1 className="text-center text-2xl font-bold text-foreground">{survey.title}</h1>
            <div className="my-4 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Pergunta {currentStep + 1} de {survey.questions.length}</span>
                    {survey.isAnonymous && <Badge variant="secondary">Suas respostas são anônimas</Badge>}
                </div>
                <Progress value={progress} />
            </div>
        </header>

        <main className="flex w-full flex-1 items-center justify-center">
             <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-4xl"
                >
                    <Card className="shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-2xl leading-relaxed">
                                {currentQuestion?.text}
                                {currentQuestion?.isMandatory && <span className="ml-2 text-destructive">*</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {currentQuestion && renderQuestion(currentQuestion)}
                             {validationError && (
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-4 text-center font-semibold text-destructive"
                                >
                                    {validationError}
                                </motion.p>
                             )}
                        </CardContent>
                    </Card>
                </motion.div>
             </AnimatePresence>
        </main>
        
        <footer className="mt-6 flex w-full max-w-4xl justify-between">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0 || isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Anterior
            </Button>
            {isLastStep ? (
                <Button size="lg" className="h-12 text-lg" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                    Enviar Respostas
                </Button>
            ) : (
                <Button variant="default" onClick={handleNext} disabled={isSubmitting}>
                    Próxima
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
        </footer>
    </div>
  );
}
