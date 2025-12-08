"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const likertOptions = [
  { value: 1, label: 'Nunca é verdade' },
  { value: 2, label: 'Na maioria das vezes não é verdade' },
  { value: 3, label: 'Às vezes é verdade, às vezes não' },
  { value: 4, label: 'Na maioria das vezes é verdade' },
  { value: 5, label: 'Sempre é verdade' },
];

interface LikertQuestionProps {
  questionId: string;
  onAnswer: (value: number) => void;
  currentAnswer?: number | string | null;
}

export function LikertQuestion({ questionId, onAnswer, currentAnswer }: LikertQuestionProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-5">
        {likertOptions.map((option, index) => (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Label
              htmlFor={`${questionId}-${option.value}`}
              className={cn(
                'flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-4 text-center transition-all hover:bg-accent hover:text-accent-foreground',
                currentAnswer === option.value
                  ? 'border-primary bg-primary/10 text-primary shadow-lg'
                  : 'border-muted bg-background'
              )}
            >
              <input
                type="radio"
                id={`${questionId}-${option.value}`}
                name={questionId}
                value={option.value}
                checked={currentAnswer === option.value}
                onChange={() => onAnswer(option.value)}
                className="sr-only"
              />
              <span className="mb-2 text-2xl font-bold">{option.value}</span>
              <span className="text-sm">{option.label}</span>
            </Label>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
