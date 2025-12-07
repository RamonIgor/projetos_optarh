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

  const categories = Object.keys(groupedQuestions).sort();

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Biblioteca de Perguntas</CardTitle>
        <CardDescription>Adicione perguntas prontas ou crie a sua.</CardDescription>
      </CardHeader>
      <ScrollArea className="flex-grow">
        <div className="px-6">
            <Accordion type="multiple" defaultValue={categories.slice(0,2)}>
            {categories.map(category => (
                <AccordionItem key={category} value={category}>
                <AccordionTrigger>{category}</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-2">
                    {groupedQuestions[category].map(q => (
                        <div key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted">
                        <p className="text-sm text-muted-foreground flex-1">{q.text}</p>
                        <Button variant="ghost" size="sm" onClick={() => onAdd(q)}>
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
