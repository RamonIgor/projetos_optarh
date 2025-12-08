
"use client";

import { type Client, type Survey } from "@/types/activity";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from "firebase/firestore";

interface ReportTemplateProps {
    client: Client;
    survey: Survey;
    responseCount: number;
    analytics: any; // Using 'any' for now, will be typed better later
}

const toDate = (dateValue: Date | Timestamp | string): Date => {
    if (dateValue instanceof Timestamp) {
        return dateValue.toDate();
    }
    return new Date(dateValue);
}

export function ReportTemplate({ client, survey, responseCount, analytics }: ReportTemplateProps) {
    const responseRate = survey.totalParticipants > 0 ? (responseCount / survey.totalParticipants) * 100 : 0;
    const opensAt = toDate(survey.opensAt);
    const closesAt = toDate(survey.closesAt);
    
    return (
        <div className="font-sans bg-white text-gray-800">
            {/* Page 1: Cover */}
            <div className="h-[1123px] w-[794px] p-16 flex flex-col justify-between border-b">
                 {/* Header */}
                <div>
                    {client.logoUrl && <img src={client.logoUrl} alt={`${client.name} Logo`} className="max-h-20 mb-10" />}
                    <h1 className="text-5xl font-bold text-gray-800">Pesquisa de Clima Organizacional</h1>
                </div>

                {/* Center Content */}
                <div className="text-center">
                    <h2 className="text-3xl font-semibold">{survey.title}</h2>
                    <p className="text-xl text-gray-600 mt-4">
                        Período de Coleta: {format(opensAt, 'dd/MM/yyyy')} a {format(closesAt, 'dd/MM/yyyy')}
                    </p>
                </div>

                 {/* Footer */}
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
                               <li key={item.category}>{item.category}</li>
                           ))}
                        </ul>
                    </div>
                     <div>
                        <h3 className="font-semibold text-2xl mb-4 text-red-700">Pontos de Atenção</h3>
                        <ul className="list-disc list-inside space-y-2 text-lg">
                            {analytics.topIssues.slice(0, 3).map((item: any) => (
                               <li key={item.category}>{item.category}</li>
                           ))}
                        </ul>
                    </div>
                </div>
            </div>
             {/* Subsequent Pages: Detailed Analysis etc. will go here */}
        </div>
    );
}

