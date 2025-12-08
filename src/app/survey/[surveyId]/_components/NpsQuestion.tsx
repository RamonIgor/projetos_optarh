"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NpsQuestionProps {
  questionId: string;
  onAnswer: (value: number) => void;
  currentAnswer?: number | string | null;
}

export function NpsQuestion({ onAnswer, currentAnswer }: NpsQuestionProps) {
  const scores = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div className="w-full">
        <div className="flex flex-wrap justify-center gap-2">
        {scores.map((score) => (
            <motion.button
            key={score}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: score * 0.03 }}
            onClick={() => onAnswer(score)}
            className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold transition-all duration-200 hover:scale-110 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                currentAnswer === score
                ? 'scale-110 border-2 border-primary bg-primary text-primary-foreground shadow-xl'
                : 'bg-background',
                score <= 6 ? 'hover:border-red-400' : score <= 8 ? 'hover:border-yellow-400' : 'hover:border-green-400'
            )}
            >
            {score}
            </motion.button>
        ))}
        </div>
        <div className="mt-4 flex justify-between px-2 text-sm text-muted-foreground">
            <span>Nada provável</span>
            <span>Muito provável</span>
        </div>
    </div>
  );
}
