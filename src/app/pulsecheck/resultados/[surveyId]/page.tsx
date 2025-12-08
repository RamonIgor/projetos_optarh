"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { type Survey, type Response as SurveyResponse, type SelectedQuestion, Answer, type Client } from '@/types/activity';
import { Loader2, ArrowLeft, Download, Users, CheckSquare, TrendingUp, TrendingDown, MessageSquare, ListTree, Target, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell, PieChart, Pie } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

const NPS_COLORS = {
  detractor: '#f87171', // red-400
  passive: '#fbbf24',    // amber-400
  promoter: '#4ade80',   // green-400
};

const LIKERT_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

const calculateNPS = (answers: number[]) => {
    if (answers.length === 0) return { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };

    const promoters = answers.filter(score => score >= 9).length;
    const detractors = answers.filter(score => score <= 6).length;
    const passives = answers.length - promoters - detractors;
    
    const promoterPercentage = (promoters / answers.length) * 100;
    const detractorPercentage = (detractors / answers.length) * 100;

    return {
        score: Math.round(promoterPercentage - detractorPercentage),
        promoters,
        passives,
        detractors,
        total: answers.length
    };
};

const getCategoryStatus = (score: number) => {
    if (score >= 80) return { label: "Excelente", color: "bg-green-500", textColor: "text-green-500" };
    if (score >= 60) return { label: "Bom", color: "bg-blue-500", textColor: "text-blue-500" };
    if (score >= 40) return { label: "Atenção", color: "bg-yellow-500", textColor: "text-yellow-500" };
    return { label: "Crítico", color: "bg-red-500", textColor: "text-red-500" };
}

function StatCard({ title, value, description, icon: Icon, children }: { title: string, value: string | number, description?: string, icon: React.ElementType, children?: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                {children}
            </CardContent>
        </Card>
    );
}

function NpsStatCard({ title, npsResult }: { title: string, npsResult: ReturnType<typeof calculateNPS> | null }) {
    if (!npsResult) return <StatCard title={title} value="N/A" description="Nenhuma resposta" icon={TrendingUp} />;
    
    const pieData = [
        { name: 'Promotores', value: npsResult.promoters, fill: NPS_COLORS.promoter },
        { name: 'Passivos', value: npsResult.passives, fill: NPS_COLORS.passive },
        { name: 'Detratores', value: npsResult.detractors, fill: NPS_COLORS.detractor },
    ].filter(d => d.value > 0);

    return (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className={`text-4xl font-bold ${npsResult.score > 0 ? 'text-green-500' : 'text-red-500'}`}>{npsResult.score > 0 ? `+${npsResult.score}` : npsResult.score}</div>
                        <p className="text-xs text-muted-foreground">
                            {npsResult.promoters} Promotores, {npsResult.passives} Passivos, {npsResult.detractors} Detratores
                        </p>
                    </div>
                     <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2}>
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
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
                    return { name: `Nota ${value}`, count: numericAnswers.filter(n => n === value).length, };
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
                    <div className="h-48 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
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
                    <ScrollArea className="h-48 mt-4">
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
                     <div className="h-48 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
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
            </CardHeader>
            <CardContent>{renderContent()}</CardContent>
        </Card>
    );
}

export default function SurveyResultsPage() {
    const { surveyId } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { clientId } = useClient();

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [client, setClient] = useState<Client | null>(null);
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
                const surveyData = { id: docSnap.id, ...docSnap.data() } as Survey;
                setSurvey(surveyData);
                const clientDocRef = doc(db, 'clients', surveyData.clientId);
                getDoc(clientDocRef).then(clientSnap => {
                    if (clientSnap.exists()) setClient(clientSnap.data() as Client);
                });
            } else {
                router.push('/pulsecheck');
            }
        });

        const responsesQuery = query(collection(db, 'pulse_check_responses'), where('clientId', '==', clientId), where('surveyId', '==', surveyId));
        const unsubResponses = onSnapshot(responsesQuery, (snapshot) => {
            setResponses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse)));
            setIsLoading(false);
        });

        return () => { unsubSurvey(); unsubResponses(); };
    }, [surveyId, clientId, db, router]);
    
    const getPersonalizedQuestionText = useCallback((text: string) => {
        return (client?.name && text.includes('[EMPRESA]')) ? text.replace(/\[EMPRESA\]/g, client.name) : text;
    }, [client]);

    const analytics = useMemo(() => {
        if (!survey || responses.length === 0) return null;

        const answersByQuestionId = responses.reduce((acc, res) => {
            Object.entries(res.answers).forEach(([qId, answer]) => {
                if (!acc[qId]) acc[qId] = [];
                acc[qId].push(answer);
            });
            return acc;
        }, {} as Record<string, Answer[]>);

        const findNpsQuestion = (category: 'eNPS' | 'Liderança NPS') => {
            return survey.questions.find(q => q.type === 'nps' && q.category.toUpperCase() === category) || null;
        }

        const eNpsQuestion = findNpsQuestion('eNPS');
        const lNpsQuestion = findNpsQuestion('Liderança NPS');

        const eNpsAnswers = eNpsQuestion ? (answersByQuestionId[eNpsQuestion.id] || []).map(a => a.answer as number) : [];
        const lNpsAnswers = lNpsQuestion ? (answersByQuestionId[lNpsQuestion.id] || []).map(a => a.answer as number) : [];
        
        const eNpsResult = calculateNPS(eNpsAnswers);
        const lNpsResult = calculateNPS(lNpsAnswers);

        const categories = survey.questions.reduce((acc, q) => {
            if (!acc[q.category]) acc[q.category] = { questions: [], score: 0 };
            acc[q.category].questions.push(q);
            return acc;
        }, {} as Record<string, { questions: SelectedQuestion[], score: number }>);
        
        Object.keys(categories).forEach(catName => {
            const category = categories[catName];
            const likertQuestions = category.questions.filter(q => q.type === 'likert');
            
            if (likertQuestions.length === 0) {
                category.score = -1; // Indicate no score applicable
                return;
            }

            const totalScore = likertQuestions.reduce((sum, q) => {
                const questionAnswers = (answersByQuestionId[q.id] || []).map(a => a.answer as number);
                if (questionAnswers.length === 0) return sum;
                const avg = questionAnswers.reduce((a, b) => a + b, 0) / questionAnswers.length;
                return sum + ((avg - 1) / 4) * 100; // Convert 1-5 scale to 0-100
            }, 0);

            categories[catName].score = Math.round(totalScore / likertQuestions.length);
        });
        
        const openFeedback = survey.questions
            .filter(q => q.type === 'open-text')
            .flatMap(q => (answersByQuestionId[q.id] || []).map(a => a.answer as string).filter(Boolean));

        return { eNpsResult, lNpsResult, categories, openFeedback, answersByQuestionId };

    }, [survey, responses]);


     if (isLoading) {
        return <div className="flex items-center justify-center min-h-[60vh] w-full"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    if (!survey) {
        return <div>Pesquisa não encontrada.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-start mb-8">
                <div>
                     <Button variant="ghost" onClick={() => router.push('/pulsecheck')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Painel</Button>
                    <h1 className="text-4xl font-bold text-primary">{survey.title}</h1>
                    <p className="mt-2 text-lg text-muted-foreground">{survey.description}</p>
                </div>
                <Button variant="outline" disabled><Download className="mr-2 h-4 w-4" />Exportar (em breve)</Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Taxa de Resposta" value={`${responses.length}/120*`} description="*Número de participantes fixo" icon={Users} />
                <NpsStatCard title="eNPS" npsResult={analytics?.eNpsResult || null} />
                <NpsStatCard title="Liderança NPS" npsResult={analytics?.lNpsResult || null} />
                <StatCard title="Tempo Médio" value="8 min*" description="*Cálculo em desenvolvimento" icon={Clock} />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><ListTree className="h-6 w-6 text-primary" /> Resultados por Categoria</h2>
                    {analytics ? (
                         <Accordion type="multiple" defaultValue={Object.keys(analytics.categories)} className="w-full">
                             {Object.entries(analytics.categories).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([name, data]) => {
                                 const status = getCategoryStatus(data.score);
                                 const hasScore = data.score !== -1;
                                 return (
                                     <AccordionItem key={name} value={name}>
                                         <AccordionTrigger className="hover:no-underline">
                                             <div className="flex justify-between items-center w-full pr-4">
                                                 <div className="flex-1 text-left">
                                                     <p className="font-bold text-lg">{name}</p>
                                                     <p className="text-sm text-muted-foreground">{data.questions.length} perguntas</p>
                                                 </div>
                                                 {hasScore ? (
                                                    <div className="flex items-center gap-4 w-1/3">
                                                         <Progress value={data.score} indicatorClassName={status.color} />
                                                        <span className={cn("font-bold text-lg w-40 text-right", status.textColor)}>{data.score}% <span className='text-sm text-muted-foreground'>de favorabilidade</span></span>
                                                    </div>
                                                 ) : (
                                                    <div className="w-1/3"></div>
                                                 )}
                                             </div>
                                         </AccordionTrigger>
                                         <AccordionContent className="space-y-4 pt-4">
                                            {data.questions.sort((a,b) => a.text.localeCompare(b.text)).map(q => (
                                                <QuestionResultCard key={q.id} question={{...q, text: getPersonalizedQuestionText(q.text)}} answers={analytics.answersByQuestionId[q.id] || []} />
                                            ))}
                                         </AccordionContent>
                                     </AccordionItem>
                                 )
                             })}
                         </Accordion>
                    ) : (
                        <p>Aguardando respostas para gerar análises.</p>
                    )}
                </div>
                 <div className="lg:col-span-1 space-y-6">
                     <h2 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Feedback Aberto</h2>
                     <Card>
                         <CardContent className="pt-6">
                             {analytics && analytics.openFeedback.length > 0 ? (
                                <ScrollArea className="h-96">
                                     <ul className="space-y-4">
                                         {analytics.openFeedback.map((text, i) => (
                                            <li key={i} className="text-sm border-l-2 border-primary pl-3 italic text-muted-foreground">"{text}"</li>
                                         ))}
                                     </ul>
                                </ScrollArea>
                             ) : (
                                <p className="text-center text-muted-foreground py-16">Nenhum feedback aberto recebido.</p>
                             )}
                         </CardContent>
                     </Card>
                 </div>
            </div>
        </div>
    );
}
