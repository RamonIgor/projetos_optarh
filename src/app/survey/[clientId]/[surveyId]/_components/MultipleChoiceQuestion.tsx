"use client";

import { motion } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface MultipleChoiceQuestionProps {
  questionId: string;
  options: string[];
  onAnswer: (value: string) => void;
  currentAnswer?: string | number | null;
}

export function MultipleChoiceQuestion({ questionId, options, onAnswer, currentAnswer }: MultipleChoiceQuestionProps) {
  return (
    <RadioGroup
      value={currentAnswer as string}
      onValueChange={onAnswer}
      className="space-y-3"
    >
      {options.map((option, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <Label
            htmlFor={`${questionId}-${index}`}
            className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10"
          >
            <RadioGroupItem value={option} id={`${questionId}-${index}`} />
            <span className="text-base font-medium">{option}</span>
          </Label>
        </motion.div>
      ))}
    </RadioGroup>
  );
}
