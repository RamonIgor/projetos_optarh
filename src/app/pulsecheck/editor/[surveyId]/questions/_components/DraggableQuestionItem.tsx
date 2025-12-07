"use client";

import { Draggable } from 'react-beautiful-dnd';
import { type SelectedQuestion } from '@/types/activity';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { memo } from 'react';

interface DraggableQuestionItemProps {
  question: SelectedQuestion;
  index: number;
  onUpdate: (id: string, updates: Partial<SelectedQuestion>) => void;
  onRemove: (id: string) => void;
  onEdit: (question: SelectedQuestion) => void;
}

const typeLabels: Record<SelectedQuestion['type'], string> = {
    'nps': 'eNPS',
    'likert': 'Likert',
    'multiple-choice': 'Múltipla Escolha',
    'open-text': 'Texto Aberto'
}

export const DraggableQuestionItem = memo(({ question, index, onUpdate, onRemove, onEdit }: DraggableQuestionItemProps) => {
  return (
    <Draggable draggableId={question.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <Card className={cn(snapshot.isDragging && 'shadow-2xl scale-105', 'bg-white')}>
            <CardContent className="p-4 flex items-start gap-4">
              <div {...provided.dragHandleProps} className="py-5 cursor-grab">
                <GripVertical className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{question.text}</p>
                <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{typeLabels[question.type]}</Badge>
                    <Badge variant="outline">{question.category}</Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`mandatory-${question.id}`}
                    checked={question.isMandatory}
                    onCheckedChange={(checked) => onUpdate(question.id, { isMandatory: checked })}
                  />
                  <Label htmlFor={`mandatory-${question.id}`} className="text-sm">Obrigatória</Label>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(question)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onRemove(question.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
});
DraggableQuestionItem.displayName = 'DraggableQuestionItem';
