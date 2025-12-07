
"use client";

import { type Survey, type Response as SurveyResponse } from '@/types/activity';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, BarChart2, Copy, Trash2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

interface SurveyCardProps {
  survey: Survey;
  responses: SurveyResponse[];
  onDelete: () => void;
  onDuplicate: () => void;
}

const statusConfig: Record<Survey['status'], { label: string; color: string; }> = {
  draft: { label: "Rascunho", color: "bg-gray-200 text-gray-800" },
  active: { label: "Ativa", color: "bg-green-200 text-green-800 animate-pulse" },
  closed: { label: "Encerrada", color: "bg-red-200 text-red-800" },
};

function calculateNPS(responses: SurveyResponse[]) {
    // Apenas um exemplo simplificado. A lógica real dependeria de como
    // a pergunta NPS é identificada nas respostas.
    const npsAnswers = responses
        .flatMap(r => Object.values(r.answers))
        .filter(a => typeof a.answer === 'number' && a.questionText.toLowerCase().includes('nps'))
        .map(a => a.answer as number);

    if (npsAnswers.length === 0) return null;

    const promoters = npsAnswers.filter(score => score >= 9).length;
    const detractors = npsAnswers.filter(score => score <= 6).length;
    
    const promoterPercentage = (promoters / npsAnswers.length) * 100;
    const detractorPercentage = (detractors / npsAnswers.length) * 100;

    return Math.round(promoterPercentage - detractorPercentage);
}

function toDate(dateValue: Date | Timestamp | string): Date {
    if (dateValue instanceof Timestamp) {
        return dateValue.toDate();
    }
    return new Date(dateValue);
}

export function SurveyCard({ survey, responses, onDelete, onDuplicate }: SurveyCardProps) {
  const router = useRouter();
  
  const surveyOpensAt = toDate(survey.opensAt);
  const surveyClosesAt = toDate(survey.closesAt);

  const status = useMemo(() => {
    if (survey.status === 'active' && isPast(surveyClosesAt)) {
      return 'closed';
    }
    if (survey.status === 'draft' && isFuture(surveyOpensAt)) {
      return 'draft';
    }
    return survey.status;
  }, [survey.status, surveyOpensAt, surveyClosesAt]);
  
  const config = statusConfig[status];

  // Placeholder para o número de participantes. A lógica real seria mais complexa.
  const totalParticipants = 120;
  const responseRate = totalParticipants > 0 ? (responses.length / totalParticipants) * 100 : 0;

  const npsScore = useMemo(() => calculateNPS(responses), [responses]);
  
  const startDate = format(surveyOpensAt, 'dd/MM/yy', { locale: ptBR });
  const endDate = format(surveyClosesAt, 'dd/MM/yy', { locale: ptBR });

  return (
    <Card className="flex flex-col shadow-md hover:shadow-xl transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl pr-4">{survey.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/pulsecheck/editor/${survey.id}`)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/pulsecheck/resultados/${survey.id}`)} disabled={responses.length === 0}>
                <BarChart2 className="mr-2 h-4 w-4" /> Ver Resultados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription>{survey.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Badge className={config.color}>{config.label}</Badge>
          <span className="text-sm text-muted-foreground">{startDate} - {endDate}</span>
        </div>
        <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Taxa de Resposta</span>
                <span>{responses.length}/{totalParticipants}</span>
            </div>
            <Progress value={responseRate} />
            <p className="text-right text-xs text-muted-foreground mt-1">{responseRate.toFixed(1)}%</p>
        </div>
      </CardContent>
      <CardFooter className="mt-auto">
        {npsScore !== null ? (
            <div className="text-center w-full">
                <p className="text-sm text-muted-foreground">eNPS</p>
                <p className="text-3xl font-bold">{npsScore}</p>
            </div>
        ) : (
            <div className="text-center w-full text-sm text-muted-foreground py-4">
                Aguardando respostas para calcular o eNPS.
            </div>
        )}
      </CardFooter>
    </Card>
  );
}
