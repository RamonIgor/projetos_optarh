"use client";

import { DragDropContext, Droppable, type DropResult } from 'react-beautiful-dnd';
import { type SelectedQuestion } from '@/types/activity';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DraggableQuestionItem } from './DraggableQuestionItem';

interface SelectedQuestionsProps {
  questions: SelectedQuestion[];
  onReorder: (startIndex: number, endIndex: number) => void;
  onUpdate: (id: string, updates: Partial<SelectedQuestion>) => void;
  onRemove: (id: string) => void;
  onEdit: (question: SelectedQuestion) => void;
}

export function SelectedQuestions({ questions, onReorder, onUpdate, onRemove, onEdit }: SelectedQuestionsProps) {
  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Perguntas Selecionadas ({questions.length})</CardTitle>
        <CardDescription>Arraste para reordenar. Edite ou remova as perguntas conforme necessário.</CardDescription>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="selected-questions">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {questions.length > 0 ? (
                    questions.map((q, index) => (
                        <DraggableQuestionItem
                            key={q.id}
                            question={q}
                            index={index}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onEdit={onEdit}
                        />
                    ))
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-semibold">Nenhuma pergunta adicionada</h3>
                        <p className="text-muted-foreground mt-1">Adicione perguntas da biblioteca ao lado.</p>
                    </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </CardContent>
    </Card>
  );
}
