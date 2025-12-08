"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import type { SelectedQuestion } from '@/types/activity';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';


interface ImportQuestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: Omit<SelectedQuestion, 'id' | 'questionId'>[]) => void;
}

const validTypes = ['nps', 'likert', 'multiple-choice', 'open-text'];

export function ImportQuestionsDialog({ isOpen, onOpenChange, onImport }: ImportQuestionsDialogProps) {
  const { toast } = useToast();
  const [textValue, setTextValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = () => {
    setIsImporting(true);
    const lines = textValue.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      toast({ title: 'Nenhum dado para importar', description: 'O campo de texto está vazio.', variant: 'destructive' });
      setIsImporting(false);
      return;
    }

    const importedQuestions: Omit<SelectedQuestion, 'id' | 'questionId'>[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(';').map(p => p.trim());
      if (parts.length < 3 || parts.length > 4) {
        errors.push(`Linha ${index + 1}: Formato inválido. Esperado: Texto;Categoria;Tipo;Opções`);
        return;
      }

      const [text, category, type, optionsStr] = parts;

      if (!text || !category || !type) {
        errors.push(`Linha ${index + 1}: Texto, categoria e tipo são obrigatórios.`);
        return;
      }
      
      const normalizedType = type.toLowerCase().replace(/\s+/g, '-');
      if (!validTypes.includes(normalizedType)) {
        errors.push(`Linha ${index + 1}: Tipo de pergunta inválido: "${type}". Válidos: nps, likert, multiple-choice, open-text.`);
        return;
      }

      let options: string[] | null = null;
      if (normalizedType === 'multiple-choice') {
        if (!optionsStr) {
          errors.push(`Linha ${index + 1}: Perguntas de múltipla escolha precisam de opções.`);
          return;
        }
        options = optionsStr.split('|').map(o => o.trim()).filter(Boolean);
        if (options.length < 2) {
          errors.push(`Linha ${index + 1}: Múltipla escolha requer pelo menos 2 opções separadas por "|".`);
          return;
        }
      }

      importedQuestions.push({
        text,
        category,
        type: normalizedType as SelectedQuestion['type'],
        isMandatory: true, // Default
        options: options,
      });
    });

    if (errors.length > 0) {
      toast({
        title: `Erro de Importação (${errors.length} erros)`,
        description: errors.join(' '),
        variant: 'destructive',
        duration: 10000,
      });
    }

    if (importedQuestions.length > 0) {
      onImport(importedQuestions);
    }

    setIsImporting(false);
    if(errors.length === 0) {
        onOpenChange(false);
        setTextValue('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Perguntas em Massa</DialogTitle>
          <DialogDescription>
            Copie e cole os dados da sua planilha (Excel, Google Sheets) no campo abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4"/>
            <AlertTitle>Formato Esperado</AlertTitle>
            <AlertDescription>
                Cada linha deve conter os seguintes campos separados por ponto e vírgula (;):
                <ol className="list-decimal pl-5 mt-2 text-xs">
                    <li><b>Texto da Pergunta:</b> O enunciado completo.</li>
                    <li><b>Categoria:</b> Ex: Cultura, Liderança.</li>
                    <li><b>Tipo:</b> `likert`, `nps`, `multiple-choice`, ou `open-text`.</li>
                    <li><b>Opções (Opcional):</b> Apenas para `multiple-choice`. Separe com uma barra vertical (|). Ex: `Opção A|Opção B`.</li>
                </ol>
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="import-data">Cole os dados aqui:</Label>
            <Textarea
              id="import-data"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              rows={10}
              placeholder={`Como você avalia a comunicação interna?;Comunicação;likert\nEm uma escala de 0 a 10, qual a probabilidade...?;eNPS;nps\nQual seu turno de trabalho?;Demografia;multiple-choice;Manhã|Tarde|Noite`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={isImporting || !textValue.trim()}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar {textValue.split('\n').filter(Boolean).length > 0 ? `(${textValue.split('\n').filter(Boolean).length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
