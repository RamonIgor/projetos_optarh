
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { type Survey, type Response as SurveyResponse, type SelectedQuestion, Answer } from '@/types/activity';
import { Loader2, ArrowLeft, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

const NPS_COLORS = {
  detractor: '#f87171', // red-400
  passive: '#fbbf24',    // amber-400
  promoter: '#4ade80',   // green-400
};

const LIKERT_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];


function calculateNPS(answers: number[]) {
    if (answers.length === 0) return { score: 0, promoters: 0, passives: 0, detractors: 0 };

    const promoters = answers.filter(score => score >= 9).length;
    const detractors = answers.filter(score => score <= 6).length;
    const passives = answers.length - promoters - detractors;
    
    const promoterPercentage = (promoters / answers.length) * 100;
    const detractorPercentage = (detractors / answers.length) * 100;

    return {
        score: Math.round(promoterPercentage - detractorPercentage),
        promoters,
        passives,
        detractors
    };
}


function StatCard({ title, value, description }: { title: string, value: string | number, description?: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-4xl">{value}</CardTitle>
            </CardHeader>
            {description && (
                <CardContent>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </CardContent>
            )}
        </Card>
    );
}

function QuestionResultCard({ question, answers }: { question: SelectedQuestion, answers: Answer[] }) {
    const renderContent = () => {
        switch (question.type) {
            case 'nps':
            case 'likert':
                const numericAnswers = answers.map(a => a.answer as number);
                const data = Array.from({ length: question.type === 'nps' ? 11 : 5 }, (_, i) => {
                    const value = question.type === 'nps' ? i : i + 1;
                    return {
                        name: `Nota ${value}`,
                        count: numericAnswers.filter(n => n === value).length,
                    };
                });
                 const getBarColor = (value: number) => {
                    if (question.type === 'nps') {
                        if (value <= 6) return NPS_COLORS.detractor;
                        if (value <= 8) return NPS_COLORS.passive;
                        return NPS_COLORS.promoter;
                    }
                    return LIKERT_COLORS[value - 1] || '#8884d8';
                };


                return (
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
                                     {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getBarColor(question.type === 'nps' ? index : index + 1)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
            
            case 'open-text':
                const textAnswers = answers.map(a => a.answer as string).filter(Boolean);
                if (textAnswers.length === 0) {
                    return <p className="text-center text-muted-foreground py-8">Nenhuma resposta de texto para esta pergunta.</p>
                }
                return (
                    <ScrollArea className="h-64">
                        <ul className="space-y-3 pr-6">
                            {textAnswers.map((text, i) => (
                                <li key={i} className="text-sm border-b pb-2 text-muted-foreground">"{text}"</li>
                            ))}
                        </ul>
                    </ScrollArea>
                )
            
            case 'multiple-choice':
                 const choiceCounts = answers.reduce((acc, a) => {
                    const choice = a.answer as string;
                    acc[choice] = (acc[choice] || 0) + 1;
                    return acc;
                 }, {} as Record<string, number>);

                 const choiceData = Object.entries(choiceCounts).map(([name, count]) => ({ name, count }));
                  if (choiceData.length === 0) {
                    return <p className="text-center text-muted-foreground py-8">Nenhuma resposta para esta pergunta.</p>
                }

                return (
                     <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={choiceData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                                <Bar dataKey="count" name="Respostas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )

            default:
                return <p>Visualização não disponível para este tipo de pergunta.</p>;
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{question.text}</CardTitle>
                <CardDescription>
                    <Badge variant="outline">{question.type}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}


export default function SurveyResultsPage() {
    const { surveyId } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { clientId } = useClient();

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [responses, setResponses] = useState<SurveyResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!clientId || !db || !surveyId) {
            setIsLoading(false);
            return;
        };

        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
        const unsubSurvey = onSnapshot(surveyDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setSurvey({ id: docSnap.id, ...docSnap.data() } as Survey);
            } else {
                router.push('/pulsecheck');
            }
        });

        const responsesQuery = query(
            collection(db, 'pulse_check_responses'),
            where('clientId', '==', clientId),
            where('surveyId', '==', surveyId)
        );
        const unsubResponses = onSnapshot(responsesQuery, (snapshot) => {
            const responsesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
            setResponses(responsesData);
            setIsLoading(false);
        });

        return () => {
            unsubSurvey();
            unsubResponses();
        };

    }, [surveyId, clientId, db, router]);

    const answersByQuestion = useMemo(() => {
        const grouped = new Map<string, Answer[]>();
        for (const response of responses) {
            for (const [questionId, answer] of Object.entries(response.answers)) {
                if (!grouped.has(questionId)) {
                    grouped.set(questionId, []);
                }
                grouped.get(questionId)!.push(answer);
            }
        }
        return grouped;
    }, [responses]);

    const overallNPS = useMemo(() => {
        const npsQuestion = survey?.questions.find(q => q.isNpsQuestion || q.type === 'nps');
        if (!npsQuestion) return null;
        
        const npsAnswers = (answersByQuestion.get(npsQuestion.id) || [])
            .map(a => a.answer as number);

        return calculateNPS(npsAnswers);
    }, [survey, answersByQuestion]);

     if (isLoading) {
        return (
          <div className="flex items-center justify-center min-h-[60vh] w-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        );
    }

    if (!survey) {
        return <div>Pesquisa não encontrada.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-start mb-8">
                <div>
                     <Button variant="ghost" onClick={() => router.push('/pulsecheck')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para o Painel
                    </Button>
                    <h1 className="text-4xl font-bold text-primary">{survey.title}</h1>
                    <p className="mt-2 text-lg text-muted-foreground">{survey.description}</p>
                </div>
                <Button variant="outline" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Resultados (em breve)
                </Button>
            </div>
            
             <div className="grid md:grid-cols-3 gap-6 mb-8">
                <StatCard title="Total de Respostas" value={responses.length} />
                <StatCard title="Taxa de Resposta" value="N/A" description="Cálculo de participantes em breve" />
                {overallNPS ? (
                    <StatCard 
                        title="eNPS Geral" 
                        value={overallNPS.score} 
                        description={`${overallNPS.promoters} promotores, ${overallNPS.passives} passivos, ${overallNPS.detractors} detratores`}
                    />
                ) : (
                     <StatCard title="eNPS Geral" value="N/A" description="Nenhuma pergunta eNPS encontrada" />
                )}
            </div>
            
            <div className="space-y-6">
                {survey.questions.map((question) => (
                    <QuestionResultCard
                        key={question.id}
                        question={question}
                        answers={answersByQuestion.get(question.id) || []}
                    />
                ))}
            </div>

        </div>
    );
}
