"use client";

import { useMemo } from 'react';
import { type Question } from '@/types/activity';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Plus } from 'lucide-react';

interface QuestionLibraryProps {
  libraryQuestions: Question[];
  onAdd: (question: Question) => void;
  onCreateCustom: () => void;
}

const categoryOrder = [
  'DEMOGRAFIA',
  'eNPS',
  'LEADERSHIP NPS',
  'DESENVOLVIMENTO PROFISSIONAL',
  'RECONHECIMENTO E REMUNERAÇÃO',
  'AMBIENTE DE TRABALHO',
  'INFRAESTRUTURA',
  'LIDERANÇA - COMUNICAÇÃO',
  'LIDERANÇA - CULTURA',
  'LIDERANÇA - FEEDBACK',
  'FEEDBACK ABERTO'
];

export function QuestionLibrary({ libraryQuestions, onAdd, onCreateCustom }: QuestionLibraryProps) {
  const groupedQuestions = useMemo(() => {
    return libraryQuestions.reduce((acc, q) => {
      if (!acc[q.category]) {
        acc[q.category] = [];
      }
      acc[q.category].push(q);
      return acc;
    }, {} as Record<string, Question[]>);
  }, [libraryQuestions]);

  const categories = useMemo(() => {
    const existingCategories = Object.keys(groupedQuestions);
    const orderedCategories = categoryOrder.filter(cat => existingCategories.includes(cat));
    const otherCategories = existingCategories.filter(cat => !categoryOrder.includes(cat)).sort();
    return [...orderedCategories, ...otherCategories];
  }, [groupedQuestions]);


  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="whitespace-nowrap">Biblioteca de Perguntas</CardTitle>
        <CardDescription>Adicione perguntas prontas ou crie a sua.</CardDescription>
      </CardHeader>
      <ScrollArea className="flex-grow">
        <div className="px-6">
            <Accordion type="multiple" defaultValue={['DEMOGRAFIA', 'eNPS']}>
            {categories.map(category => (
                <AccordionItem key={category} value={category}>
                <AccordionTrigger>{category}</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-2">
                    {groupedQuestions[category].sort((a, b) => a.order - b.order).map(q => (
                        <div key={q.id} className="flex items-start justify-between gap-4 p-2 rounded-md hover:bg-muted">
                            <p className="text-sm text-muted-foreground flex-1 pt-1.5">{q.text}</p>
                            <Button variant="ghost" size="sm" onClick={() => onAdd(q)} className="shrink-0">
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                            </Button>
                        </div>
                    ))}
                    </div>
                </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button className="w-full" variant="outline" onClick={onCreateCustom}>
            <PlusCircle className="mr-2 h-4 w-4"/>
            Criar Pergunta Personalizada
        </Button>
      </div>
    </Card>
  );
}
