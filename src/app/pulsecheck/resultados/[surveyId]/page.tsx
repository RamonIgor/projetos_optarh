
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { type Survey, type Response as SurveyResponse, type SelectedQuestion, type Answer, type Client } from '@/types/activity';
import { Loader2, ArrowLeft, Download, Users, TrendingUp, MessageSquare, ListTree, Target, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell, PieChart, Pie } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { calculateNPS, calculateCategoryScore, getCategoryStatus, getTopIssues } from '@/lib/pulsecheck-analytics';
import { differenceInMinutes } from 'date-fns';
import { Tooltip as TooltipComponent, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportTemplate } from './_components/ReportTemplate';


const NPS_COLORS = {
  detractor: '#f87171', // red-400
  passive: '#fbbf24',    // amber-400
  promoter: '#4ade80',   // green-400
};

const LIKERT_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

const STATUS_CONFIG: Record<ReturnType<typeof getCategoryStatus>, { label: string; color: string; textColor: string }> = {
    excelente: { label: "Excelente", color: "bg-green-500", textColor: "text-green-500" },
    bom: { label: "Bom", color: "bg-blue-500", textColor: "text-blue-500" },
    atencao: { label: "Atenção", color: "bg-yellow-500", textColor: "text-yellow-500" },
    critico: { label: "Crítico", color: "bg-red-500", textColor: "text-red-500" }
};


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
    if (!npsResult || npsResult.total === 0) return <StatCard title={title} value="N/A" description="Nenhuma resposta" icon={TrendingUp} />;
    
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
                        <div className={`text-4xl font-bold ${npsResult.score >= 0 ? 'text-green-500' : 'text-red-500'}`}>{npsResult.score > 0 ? `+${npsResult.score}` : npsResult.score}</div>
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
    const reportRef = useRef<HTMLDivElement>(null);

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [responses, setResponses] = useState<SurveyResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        if (!clientId || !db || !surveyId) {
            setIsLoading(false);
            return;
        }

        let unsubResponses: (() => void) | null = null;

        const surveyDocRef = doc(db, 'clients', clientId, 'surveys', surveyId as string);
        const unsubSurvey = onSnapshot(surveyDocRef, (surveySnap) => {
            if (surveySnap.exists()) {
                const surveyData = { id: surveySnap.id, ...surveySnap.data() } as Survey;
                setSurvey(surveyData);

                // Fetch client data
                const clientDocRef = doc(db, 'clients', surveyData.clientId);
                getDoc(clientDocRef).then(clientSnap => {
                    if (clientSnap.exists()) {
                        setClient(clientSnap.data() as Client);
                    }
                });

                // Now that we have the survey's clientId, we can query for responses
                if (unsubResponses) unsubResponses(); // Unsubscribe from previous listener if any

                const responsesQuery = query(
                    collection(db, 'pulse_check_responses'),
                    where('surveyId', '==', surveyData.id),
                    where('clientId', '==', surveyData.clientId)
                );
                
                unsubResponses = onSnapshot(responsesQuery, (responsesSnap) => {
                    const responsesData = responsesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
                    setResponses(responsesData);
                    setIsLoading(false);
                }, () => {
                    setIsLoading(false);
                });

            } else {
                router.push('/pulsecheck');
                setIsLoading(false);
            }
        }, () => {
            setIsLoading(false);
        });

        return () => {
            unsubSurvey();
            if (unsubResponses) unsubResponses();
        };
    }, [surveyId, clientId, db, router]);
    
    const getPersonalizedQuestionText = useCallback((text: string) => {
        return (client?.name && text.includes('[EMPRESA]')) ? text.replace(/\[EMPRESA\]/g, client.name) : text;
    }, [client]);

    const generatePdf = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            
            // A4 dimensions in 'pt': 595.28 x 841.89
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // Calculate height of the image in the PDF
            const ratio = imgWidth / pdfWidth;
            const canvasImgHeight = imgHeight / ratio;
            
            let heightLeft = canvasImgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasImgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasImgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Relatorio_${survey?.title.replace(/\s/g, '_')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const analytics = useMemo(() => {
        if (!survey || !responses || !client) return null;

        const answersByQuestionId = responses.reduce((acc, res) => {
            Object.entries(res.answers).forEach(([qId, answer]) => {
                if (!acc[qId]) acc[qId] = [];
                acc[qId].push(answer);
            });
            return acc;
        }, {} as Record<string, Answer[]>);

        const findNpsQuestion = (category: string) => {
            const normalizedCategory = category.toLowerCase();
            const q = survey.questions.find(q => q.category.toLowerCase() === normalizedCategory);
            return q && q.type === 'nps' ? q : null;
        };

        const eNpsQuestion = findNpsQuestion('enps');
        const lNpsQuestion = findNpsQuestion('liderança nps');

        const eNpsAnswers = eNpsQuestion ? (answersByQuestionId[eNpsQuestion.id] || []).map(a => a.answer as number) : [];
        const lNpsAnswers = lNpsQuestion ? (answersByQuestionId[lNpsQuestion.id] || []).map(a => a.answer as number) : [];

        const eNpsResult = calculateNPS(eNpsAnswers);
        const lNpsResult = calculateNPS(lNpsAnswers);

        const categories = survey.questions.reduce((acc, q) => {
            if (q.category === 'eNPS' || q.category === 'Liderança NPS' || q.category === 'DEMOGRAFIA' || q.category === 'FEEDBACK ABERTO') return acc;
            if (!acc[q.category]) acc[q.category] = { questions: [], score: 0, status: 'bom' };
            acc[q.category].questions.push(q);
            return acc;
        }, {} as Record<string, { questions: SelectedQuestion[], score: number, status: ReturnType<typeof getCategoryStatus> }>);

        Object.keys(categories).forEach(catName => {
            const category = categories[catName];
            const categoryResult = calculateCategoryScore(category.questions, answersByQuestionId);
            category.score = categoryResult.score;
            category.status = categoryResult.status;
        });

        const openFeedback = survey.questions
            .filter(q => q.type === 'open-text')
            .flatMap(q => (answersByQuestionId[q.id] || []).map(a => a.answer as string).filter(Boolean));

        const durations = responses
            .map(r => {
                if (r.startedAt && r.submittedAt) {
                    const start = r.startedAt instanceof Timestamp ? r.startedAt.toDate() : new Date(r.startedAt);
                    const end = r.submittedAt instanceof Timestamp ? r.submittedAt.toDate() : new Date(r.submittedAt);
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        return differenceInMinutes(end, start);
                    }
                }
                return null;
            })
            .filter((d): d is number => d !== null && d >= 0);

        const averageTime = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

        const topIssues = getTopIssues(categories);
        const topStrengths = getTopIssues(categories).reverse();

        return { eNpsResult, lNpsResult, categories, openFeedback, answersByQuestionId, averageTime, topIssues, topStrengths };
    }, [survey, responses, client]);


     if (isLoading || !analytics || !survey || !client) {
        return <div className="flex items-center justify-center min-h-[60vh] w-full"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    
    const responseRate = survey.totalParticipants > 0 ? (responses.length / survey.totalParticipants) * 100 : 0;

    return (
        <div className="max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-start mb-8">
                <div>
                     <Button variant="ghost" onClick={() => router.push('/pulsecheck')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Painel</Button>
                    <h1 className="text-4xl font-bold text-primary">{survey.title}</h1>
                    <p className="mt-2 text-lg text-muted-foreground">{survey.description}</p>
                </div>
                 <Button onClick={generatePdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Exportar Relatório
                </Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Taxa de Resposta" value={`${responseRate.toFixed(1)}%`} description={`${responses.length} de ${survey.totalParticipants} respostas`} icon={Users} />
                <NpsStatCard title="eNPS" npsResult={analytics?.eNpsResult || null} />
                <NpsStatCard title="Liderança NPS" npsResult={analytics?.lNpsResult || null} />
                <StatCard title="Tempo Médio" value={analytics?.averageTime ? `${analytics.averageTime} min` : 'N/A'} description="Tempo médio de resposta" icon={Clock} />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><ListTree className="h-6 w-6 text-primary" /> Resultados por Categoria</h2>
                    {analytics ? (
                         <Accordion type="multiple" defaultValue={Object.keys(analytics.categories)} className="w-full">
                             {Object.entries(analytics.categories).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([name, data]:[string, any]) => {
                                 const status = STATUS_CONFIG[data.status];
                                 const hasScore = data.score !== -1;
                                 
                                 return (
                                     <AccordionItem key={name} value={name}>
                                         <AccordionTrigger className="hover:no-underline">
                                             <div className="flex justify-between items-center w-full pr-4">
                                                 <div className="flex-1 text-left">
                                                     <p className="font-bold text-lg">{name}</p>
                                                 </div>
                                                 {hasScore ? (
                                                    <div className="flex items-center gap-4 w-1/2">
                                                         <Progress value={data.score} indicatorClassName={status.color} />
                                                        <span className={cn("font-bold text-lg w-48 text-right", status.textColor)}>{data.score}% de favorabilidade</span>
                                                    </div>
                                                 ) : (
                                                    <div className="w-1/2"></div>
                                                 )}
                                             </div>
                                         </AccordionTrigger>
                                         <AccordionContent className="space-y-4 pt-4">
                                            {data.questions.sort((a:any,b:any) => a.text.localeCompare(b.text)).map((q: SelectedQuestion) => (
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
                                         {analytics.openFeedback.map((text: string, i: number) => (
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
             {/* Hidden component for PDF rendering */}
            <div className="fixed -left-[9999px] top-0 w-[794px] bg-white" ref={reportRef}>
               {client && survey && analytics && (
                 <ReportTemplate 
                   client={client} 
                   survey={survey} 
                   responseCount={responses.length}
                   analytics={analytics} 
                 />
               )}
            </div>
        </div>
    );
}
