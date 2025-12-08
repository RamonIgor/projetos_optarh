"use client";

import { Textarea } from '@/components/ui/textarea';

interface OpenTextQuestionProps {
  onAnswer: (value: string) => void;
  currentAnswer?: string | number | null;
}

export function OpenTextQuestion({ onAnswer, currentAnswer }: OpenTextQuestionProps) {
  return (
    <Textarea
      value={currentAnswer as string || ''}
      onChange={(e) => onAnswer(e.target.value)}
      rows={5}
      className="text-lg"
      placeholder="Sua resposta aqui..."
    />
  );
}
