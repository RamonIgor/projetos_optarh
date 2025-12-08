"use client";

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type Question, type SelectedQuestion } from '@/types/activity';
import { cn } from '@/lib/utils';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Scale, List, Hash, TextCursorInput } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const questionBuilderSchema = z.object({
  text: z.string().min(5, "O texto da pergunta é muito curto.").max(500, "O texto da pergunta não pode exceder 500 caracteres."),
  category: z.string().min(2, "A categoria é obrigatória."),
  newCategory: z.string().optional(),
  type: z.enum(['nps', 'likert', 'multiple-choice', 'open-text']),
  options: z.array(z.object({ value: z.string().min(1, "A opção não pode estar vazia.") })).optional(),
  isMandatory: z.boolean().default(true),
}).superRefine((data, ctx) => {
    if (data.category === 'new' && (!data.newCategory || data.newCategory.length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "O nome da nova categoria é obrigatório.",
            path: ['newCategory'],
        });
    }
    if (data.type === 'multiple-choice' && (!data.options || data.options.length < 2)) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Múltipla escolha requer pelo menos 2 opções.",
            path: ['options'],
        });
    }
});


type QuestionBuilderFormValues = z.infer<typeof questionBuilderSchema>;

interface QuestionBuilderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (questionData: Omit<SelectedQuestion, 'id' | 'questionId'>) => void;
  questionToEdit?: SelectedQuestion | Question | null;
  allCategories: string[];
}

const typeOptions = [
    { value: 'nps', label: 'Escala 0-10 (eNPS)', icon: Hash },
    { value: 'likert', label: 'Likert 5 pontos', icon: Scale },
    { value: 'multiple-choice', label: 'Múltipla Escolha', icon: List },
    { value: 'open-text', label: 'Texto Aberto', icon: TextCursorInput },
] as const;

export function QuestionBuilderDialog({ isOpen, onOpenChange, onSave, questionToEdit, allCategories }: QuestionBuilderDialogProps) {
  const form = useForm<QuestionBuilderFormValues>({
    resolver: zodResolver(questionBuilderSchema),
    defaultValues: {
      text: '',
      category: '',
      newCategory: '',
      type: 'likert',
      options: [{ value: '' }, { value: '' }],
      isMandatory: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });
  
  const watchedValues = form.watch();

  useEffect(() => {
    if (isOpen && questionToEdit) {
      form.reset({
        text: questionToEdit.text,
        category: questionToEdit.category,
        type: questionToEdit.type,
        options: questionToEdit.options?.map(opt => ({ value: opt })) || [{ value: '' }, { value: '' }],
        isMandatory: (questionToEdit as SelectedQuestion).isMandatory ?? true,
      });
    } else if (!isOpen) {
        form.reset();
    }
  }, [isOpen, questionToEdit, form]);

  const onSubmit = (data: QuestionBuilderFormValues) => {
    const finalCategory = data.category === 'new' ? data.newCategory! : data.category;
    const finalQuestionData = {
        isMandatory: data.isMandatory,
        text: data.text,
        category: finalCategory,
        type: data.type,
        options: data.type === 'multiple-choice' ? data.options?.map(opt => opt.value) : null,
    };
    onSave(finalQuestionData);
    onOpenChange(false);
  };

  const renderPreview = () => {
    return (
        <div className="space-y-3">
            <h4 className="font-medium text-lg">{watchedValues.text || "Texto da sua pergunta aparecerá aqui"}</h4>
            {watchedValues.type === 'nps' && (
                <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-muted rounded-md">
                    <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
                </div>
            )}
            {watchedValues.type === 'likert' && (
                 <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-center gap-2">
                    {['Discordo Totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo Totalmente'].map(label => (
                        <div key={label} className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 border rounded-full"></div>
                            <span className="text-xs">{label}</span>
                        </div>
                    ))}
                </div>
            )}
            {watchedValues.type === 'multiple-choice' && (
                <div className="space-y-2">
                    {(watchedValues.options || []).map((opt, i) => (
                       <div key={i} className="flex items-center gap-2">
                           <div className="w-4 h-4 border rounded-sm"></div>
                           <span className="text-muted-foreground">{opt.value || `Opção ${i+1}`}</span>
                       </div>
                    ))}
                </div>
            )}
            {watchedValues.type === 'open-text' && (
                <div className="p-2 border border-dashed rounded-md text-muted-foreground">
                    Espaço para resposta de texto...
                </div>
            )}
        </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full flex flex-col">
        <DialogHeader>
          <DialogTitle>{questionToEdit ? "Editar Pergunta" : "Criar Nova Pergunta"}</DialogTitle>
          <DialogDescription>
            Crie uma pergunta personalizada que será adicionada a esta pesquisa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
            <div className="grid lg:grid-cols-2 gap-8 flex-1">
              <div className="space-y-8">
                  <FormField control={form.control} name="text" render={({ field }) => (
                      <FormItem>
                          <div className="flex justify-between items-baseline">
                              <FormLabel>Texto da Pergunta</FormLabel>
                              <span className="text-xs text-muted-foreground">{field.value.length} / 500</span>
                          </div>
                          <FormControl><Textarea placeholder="Ex: Em uma escala de 0 a 10..." {...field} rows={5} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />

                  <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Tipo de Resposta</FormLabel>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} value={field.value} className="grid grid-cols-2 gap-2">
                              {typeOptions.map(opt => (
                                  <FormItem key={opt.value}>
                                      <FormControl>
                                          <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                                      </FormControl>
                                      <Label htmlFor={opt.value} className={cn("flex flex-col items-center justify-center gap-2 rounded-md border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === opt.value && "border-primary")}>
                                          <opt.icon className="h-6 w-6" />
                                          {opt.label}
                                      </Label>
                                  </FormItem>
                              ))}
                          </RadioGroup>
                          <FormMessage />
                      </FormItem>
                  )} />

                  {watchedValues.type === 'multiple-choice' && (
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
                  <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="category" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Categoria</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                      <SelectItem value="new" className="text-primary font-bold">
                                          + Nova Categoria
                                      </SelectItem>
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )} />
                      {watchedValues.category === 'new' && (
                          <FormField control={form.control} name="newCategory" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Nome da Nova Categoria</FormLabel>
                                  <FormControl><Input {...field} placeholder="Ex: Cultura" /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      )}
                  </div>

                  <FormField control={form.control} name="isMandatory" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                              <FormLabel>Obrigatória</FormLabel>
                              <FormDescription>
                                  O colaborador deverá responder esta pergunta para submeter.
                              </FormDescription>
                          </div>
                          <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                      </FormItem>
                  )} />
              </div>
              <div className="flex flex-col gap-6">
                  <h3 className="text-lg font-semibold border-b pb-2">Preview da Pergunta</h3>
                  <Card className="bg-muted/50 flex-grow flex items-center">
                      <CardContent className="p-6 w-full">
                          {renderPreview()}
                      </CardContent>
                  </Card>
              </div>
            </div>
            <div className="mt-auto pt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit">Adicionar Pergunta</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
