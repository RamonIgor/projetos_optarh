
"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, File, X, Info } from 'lucide-react';
import type { SelectedQuestion } from '@/types/activity';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface ImportQuestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: Omit<SelectedQuestion, 'id' | 'questionId'>[]) => void;
}

const validTypes = ['nps', 'likert', 'multiple-choice', 'open-text'];
const requiredHeaders = ['texto', 'categoria', 'tipo'];

const exampleData = [
    { texto: 'Em uma escala de 0 a 10...', categoria: 'eNPS', tipo: 'nps', opcoes: ''},
    { texto: 'A empresa me oferece...', categoria: 'DESENVOLVIMENTO', tipo: 'likert', opcoes: ''},
    { texto: 'Qual sua área?', categoria: 'DEMOGRAFIA', tipo: 'multiple-choice', opcoes: 'Financeiro|Marketing|RH'},
    { texto: 'Sugestões sobre a liderança...', categoria: 'FEEDBACK', tipo: 'open-text', opcoes: ''},
]

export function ImportQuestionsDialog({ isOpen, onOpenChange, onImport }: ImportQuestionsDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0];
      if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx'))) {
        setFile(selectedFile);
      } else {
        toast({ title: 'Arquivo Inválido', description: 'Por favor, selecione um arquivo .xlsx.', variant: 'destructive'});
        setFile(null);
      }
    }
  };

  const handleImport = () => {
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[];
            
            if (json.length < 2) { // Header + at least one data row
                throw new Error("A planilha está vazia ou contém apenas o cabeçalho.");
            }

            const headerRow = Object.values(json[0]).map(h => String(h).toLowerCase().trim());
            const missingHeaders = requiredHeaders.filter(h => !headerRow.includes(h));
            if (missingHeaders.length > 0) {
                 throw new Error(`Cabeçalhos ausentes na planilha: ${missingHeaders.join(', ')}. Use 'Texto', 'Categoria', 'Tipo', 'Opcoes'.`);
            }

            const headerMap = (Object.entries(json[0]) as [string, string][]).reduce((acc, [key, value]) => {
                acc[value.toLowerCase().trim()] = key;
                return acc;
            }, {} as Record<string, string>);
            

            const importedQuestions: Omit<SelectedQuestion, 'id' | 'questionId'>[] = [];
            const errors: string[] = [];

            json.slice(1).forEach((row, index) => {
                const text = row[headerMap.texto];
                const category = row[headerMap.categoria];
                const type = row[headerMap.tipo];
                const optionsStr = row[headerMap.opcoes];

                if (!text || !category || !type) {
                    errors.push(`Linha ${index + 2}: Texto, categoria e tipo são obrigatórios.`);
                    return;
                }
                
                const normalizedType = String(type).toLowerCase().replace(/\s+/g, '-');
                if (!validTypes.includes(normalizedType)) {
                    errors.push(`Linha ${index + 2}: Tipo de pergunta inválido: "${type}".`);
                    return;
                }

                let options: string[] | null = null;
                if (normalizedType === 'multiple-choice') {
                    if (!optionsStr) {
                        errors.push(`Linha ${index + 2}: Perguntas de múltipla escolha precisam de opções.`);
                        return;
                    }
                    options = String(optionsStr).split('|').map(o => o.trim()).filter(Boolean);
                    if (options.length < 2) {
                        errors.push(`Linha ${index + 2}: Múltipla escolha requer pelo menos 2 opções separadas por "|".`);
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
                throw new Error(errors.join(' '));
            }
            
            if (importedQuestions.length > 0) {
                onImport(importedQuestions);
                onOpenChange(false);
                setFile(null);
            }

        } catch (error: any) {
            toast({
                title: "Erro de Importação",
                description: error.message || "Ocorreu um erro ao processar a planilha.",
                variant: 'destructive',
                duration: 10000,
            });
        } finally {
            setIsImporting(false);
        }
    };
    
    reader.onerror = () => {
        toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
        setIsImporting(false);
    }
    
    reader.readAsBinaryString(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setFile(null); onOpenChange(open); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Perguntas via Planilha</DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo .xlsx para adicionar múltiplas perguntas de uma só vez.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <Alert>
            <Info className="h-4 w-4"/>
            <AlertTitle>Instruções</AlertTitle>
            <AlertDescription>
              A primeira linha da sua planilha deve ser um cabeçalho com os títulos: <strong>Texto</strong>, <strong>Categoria</strong>, <strong>Tipo</strong> e <strong>Opcoes</strong>.
              Os tipos válidos são: `likert`, `nps`, `multiple-choice`, ou `open-text`. A coluna `Opcoes` só é necessária para o tipo `multiple-choice`, com as opções separadas por `|`.
              <br/>
              <Button variant="link" asChild className="p-0 h-auto mt-2">
                <Link href="/pulsecheck_questions_template.xlsx" download>Baixar template de exemplo (.xlsx)</Link>
              </Button>
            </AlertDescription>
          </Alert>

          <div className='my-4'>
             <Label className="font-semibold">Exemplo de Formato:</Label>
              <div className="mt-2 rounded-lg border">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Texto</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Opcoes</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {exampleData.map((row, i) => (
                            <TableRow key={i}>
                                <TableCell className="text-xs">{row.texto}</TableCell>
                                <TableCell className="text-xs">{row.categoria}</TableCell>
                                <TableCell className="text-xs">{row.tipo}</TableCell>
                                <TableCell className="text-xs">{row.opcoes}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>
          </div>

          <div>
            <Label htmlFor="file-upload" className="block mb-2 font-semibold">Seu arquivo .xlsx</Label>
            {file ? (
                <div className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                        <File className="h-5 w-5 text-muted-foreground"/>
                        <span className="text-sm font-medium">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                        <X className="h-4 w-4"/>
                    </Button>
                </div>
            ) : (
                <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    className="cursor-pointer file:cursor-pointer file:font-semibold file:text-primary"
                />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={isImporting || !file}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar para Biblioteca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
