"use client";

import { useMemo } from 'react';
import { type Question, type SelectedQuestion } from '@/types/activity';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionLibraryProps {
  libraryQuestions: Question[];
  selectedQuestions: SelectedQuestion[];
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

export function QuestionLibrary({ libraryQuestions, selectedQuestions, onAdd, onCreateCustom }: QuestionLibraryProps) {
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
  
  const selectedQuestionIds = useMemo(() => new Set(selectedQuestions.map(q => q.questionId)), [selectedQuestions]);


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
                    {groupedQuestions[category].sort((a, b) => a.order - b.order).map(q => {
                        const isAdded = selectedQuestionIds.has(q.id);
                        return (
                            <div key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted">
                                <p className="text-sm text-muted-foreground flex-1 pt-1.5">{q.text}</p>
                                <Button 
                                    variant={isAdded ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => onAdd(q)} 
                                    className={cn("shrink-0", isAdded && "text-green-600 border-green-600 hover:text-green-700")}
                                    disabled={isAdded}
                                >
                                    {isAdded ? (
                                        <Check className="h-4 w-4 mr-1" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-1" />
                                    )}
                                    {isAdded ? 'Adicionada' : 'Adicionar'}
                                </Button>
                            </div>
                        );
                    })}
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
