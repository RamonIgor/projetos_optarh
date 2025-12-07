"use client";

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type Question, type SelectedQuestion } from '@/types/activity';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const questionBuilderSchema = z.object({
  text: z.string().min(5, "O texto da pergunta é muito curto."),
  category: z.string().min(2, "A categoria é obrigatória."),
  type: z.enum(['nps', 'likert', 'multiple-choice', 'open-text']),
  options: z.array(z.object({ value: z.string().min(1, "A opção não pode estar vazia.") })).optional(),
}).refine(data => {
    if (data.type === 'multiple-choice') {
        return data.options && data.options.length >= 2;
    }
    return true;
}, {
    message: "Perguntas de múltipla escolha devem ter pelo menos 2 opções.",
    path: ['options'],
});

type QuestionBuilderFormValues = z.infer<typeof questionBuilderSchema>;

interface QuestionBuilderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (questionData: Omit<SelectedQuestion, 'id'>) => void;
  questionToEdit?: SelectedQuestion | Question | null;
  allCategories: string[];
}

export function QuestionBuilderDialog({ isOpen, onOpenChange, onSave, questionToEdit, allCategories }: QuestionBuilderDialogProps) {
  const form = useForm<QuestionBuilderFormValues>({
    resolver: zodResolver(questionBuilderSchema),
    defaultValues: {
      text: '',
      category: '',
      type: 'likert',
      options: [{ value: '' }, { value: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });
  
  const questionType = form.watch('type');

  useEffect(() => {
    if (isOpen && questionToEdit) {
      form.reset({
        text: questionToEdit.text,
        category: questionToEdit.category,
        type: questionToEdit.type,
        options: questionToEdit.options?.map(opt => ({ value: opt })) || [{ value: '' }, { value: '' }],
      });
    } else if (!isOpen) {
        form.reset();
    }
  }, [isOpen, questionToEdit, form]);

  const onSubmit = (data: QuestionBuilderFormValues) => {
    const finalQuestionData = {
        questionId: (questionToEdit as any)?.questionId || 'custom',
        isMandatory: (questionToEdit as any)?.isMandatory || true,
        ...data,
        options: data.type === 'multiple-choice' ? data.options?.map(opt => opt.value) : [],
    };
    onSave(finalQuestionData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{questionToEdit ? "Editar Pergunta" : "Criar Pergunta Personalizada"}</DialogTitle>
          <DialogDescription>
            Defina os detalhes da sua pergunta. Ela será adicionada à lista de perguntas selecionadas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] p-1">
                <div className="space-y-6 pr-6">
                    <FormField control={form.control} name="text" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Texto da Pergunta</FormLabel>
                        <FormControl><Textarea placeholder="Ex: Em uma escala de 0 a 10..." {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Resposta</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="likert">Escala Likert (Discordo/Concordo)</SelectItem>
                                        <SelectItem value="nps">Escala NPS (0 a 10)</SelectItem>
                                        <SelectItem value="multiple-choice">Múltipla Escolha</SelectItem>
                                        <SelectItem value="open-text">Texto Aberto</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Categoria</FormLabel>
                                <FormControl><Input list="category-suggestions" placeholder="Ex: Comunicação" {...field} /></FormControl>
                                <datalist id="category-suggestions">
                                    {allCategories.map(cat => <option key={cat} value={cat} />)}
                                </datalist>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    {questionType === 'multiple-choice' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <FormLabel>Opções de Resposta</FormLabel>
                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                     <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`options.${index}.value`}
                                        render={({ field: optionField }) => (
                                             <FormItem className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input {...optionField} placeholder={`Opção ${index + 1}`} />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                             <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Opção
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar Pergunta</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
