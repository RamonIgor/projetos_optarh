
"use client";

import { type Client, type Survey, type SelectedQuestion, type Answer } from "@/types/activity";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from "firebase/firestore";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface ReportTemplateProps {
    client: Client;
    survey: Survey;
    responseCount: number;
    analytics: any; // Using 'any' for now, will be typed better later
}

const NPS_COLORS = {
  detractor: '#f87171', // red-400
  passive: '#fbbf24',    // amber-400
  promoter: '#4ade80',   // green-400
};

const LIKERT_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

const toDate = (dateValue: Date | Timestamp | string): Date => {
    if (dateValue instanceof Timestamp) {
        return dateValue.toDate();
    }
    return new Date(dateValue);
}

const QuestionResultChart = ({ question, answers }: { question: SelectedQuestion, answers: Answer[] }) => {
    if (!answers || answers.length === 0) {
        return <div className="h-40 w-full flex items-center justify-center text-sm text-gray-400">Sem respostas.</div>;
    }
    
    const numericAnswers = answers.map(a => a.answer as number);
    const data = Array.from({ length: question.type === 'nps' ? 11 : 5 }, (_, i) => {
        const value = question.type === 'nps' ? i : i + 1;
        return { name: `${value}`, count: numericAnswers.filter(n => n === value).length };
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
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={20} />
                    <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(question.type === 'nps' ? index : index + 1)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};


export function ReportTemplate({ client, survey, responseCount, analytics }: ReportTemplateProps) {
    const responseRate = survey.totalParticipants > 0 ? (responseCount / survey.totalParticipants) * 100 : 0;
    const opensAt = toDate(survey.opensAt);
    const closesAt = toDate(survey.closesAt);
    
    return (
        <div className="font-sans bg-white text-gray-800">
            {/* Page 1: Cover */}
            <div className="h-[1123px] w-[794px] p-16 flex flex-col justify-between border-b">
                <div>
                    {client.logoUrl && <img src={client.logoUrl} alt={`${client.name} Logo`} className="max-h-20 mb-10" />}
                    <h1 className="text-5xl font-bold text-gray-800">Pesquisa de Clima Organizacional</h1>
                </div>

                <div className="text-center">
                    <h2 className="text-3xl font-semibold">{survey.title}</h2>
                    <p className="text-xl text-gray-600 mt-4">
                        Período de Coleta: {format(opensAt, 'dd/MM/yyyy')} a {format(closesAt, 'dd/MM/yyyy')}
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-lg font-medium">{client.name}</p>
                    <p className="text-md text-gray-500">Relatório gerado em: {format(new Date(), 'dd/MM/yyyy')}</p>
                </div>
            </div>

            {/* Page 2: Executive Summary */}
            <div className="h-[1123px] w-[794px] p-16 border-b">
                <h2 className="text-3xl font-bold mb-10">Sumário Executivo</h2>

                <div className="grid grid-cols-2 gap-8 text-lg">
                    <div>
                        <h3 className="font-semibold text-xl mb-2">Taxa de Resposta</h3>
                        <p className="text-4xl font-bold">{responseRate.toFixed(1)}%</p>
                        <p className="text-gray-600">{responseCount} de {survey.totalParticipants} colaboradores</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-xl mb-2">eNPS (Employee Net Promoter Score)</h3>
                        <p className={`text-4xl font-bold ${analytics.eNpsResult.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {analytics.eNpsResult.score > 0 ? `+${analytics.eNpsResult.score}` : analytics.eNpsResult.score}
                        </p>
                        <p className="text-gray-600">Mede a lealdade e a probabilidade de recomendação.</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-xl mb-2">Liderança NPS</h3>
                        <p className={`text-4xl font-bold ${analytics.lNpsResult.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {analytics.lNpsResult.score > 0 ? `+${analytics.lNpsResult.score}` : analytics.lNpsResult.score}
                        </p>
                        <p className="text-gray-600">Avalia a percepção da equipe sobre a eficácia da liderança.</p>
                    </div>
                </div>

                 <div className="mt-16 grid grid-cols-2 gap-12">
                    <div>
                        <h3 className="font-semibold text-2xl mb-4 text-green-700">Pontos Fortes</h3>
                        <ul className="list-disc list-inside space-y-2 text-lg">
                           {analytics.topStrengths.slice(0, 3).map((item: any) => (
                               <li key={item.category}>{item.category} ({item.score}%)</li>
                           ))}
                        </ul>
                    </div>
                     <div>
                        <h3 className="font-semibold text-2xl mb-4 text-red-700">Pontos de Atenção</h3>
                        <ul className="list-disc list-inside space-y-2 text-lg">
                            {analytics.topIssues.slice(0, 3).map((item: any) => (
                               <li key={item.category}>{item.category} ({item.score}%)</li>
                           ))}
                        </ul>
                    </div>
                </div>
            </div>

             {Object.entries(analytics.categories).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([name, data]: [string, any]) => (
                <div key={name} className="h-[1123px] w-[794px] p-16 border-b">
                    <h2 className="text-3xl font-bold mb-4">{name}</h2>
                    <div className="flex justify-between items-baseline mb-8">
                        <p className="text-xl text-gray-600">Score de Favorabilidade</p>
                        <p className="text-3xl font-bold">{data.score}%</p>
                    </div>
                    <div className="space-y-6">
                        {data.questions.map((q: SelectedQuestion) => (
                            <div key={q.id}>
                                <h4 className="font-semibold text-lg">{q.text}</h4>
                                <QuestionResultChart question={q} answers={analytics.answersByQuestionId[q.id] || []} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            <div className="h-[1123px] w-[794px] p-16">
                 <h2 className="text-3xl font-bold mb-8">Feedback Aberto</h2>
                 {analytics && analytics.openFeedback.length > 0 ? (
                    <ul className="space-y-4 columns-2 gap-8">
                        {analytics.openFeedback.map((text: string, i: number) => (
                            <li key={i} className="text-sm border-l-2 border-gray-200 pl-3 italic text-gray-600 break-inside-avoid">"{text}"</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-16">Nenhum feedback aberto recebido.</p>
                )}
            </div>

        </div>
    );
}
