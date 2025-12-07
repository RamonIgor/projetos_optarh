"use client";

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { seedDefaultQuestions } from '@/lib/seed-questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SeedPage() {
    const db = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ addedCount: number, skippedCount: number } | null>(null);
    
    // Simple protection: only run in development environment
    if (process.env.NODE_ENV !== 'development') {
        return (
            <div className="flex justify-center items-center h-screen">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <CardTitle className="text-destructive">Acesso Negado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Esta funcionalidade está disponível apenas em ambiente de desenvolvimento.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleSeed = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const seedResult = await seedDefaultQuestions(db);
            setResult(seedResult);
            toast({
                title: "Banco de Perguntas Populado!",
                description: `${seedResult.addedCount} perguntas adicionadas. ${seedResult.skippedCount} já existentes.`,
            });
        } catch (error) {
            console.error("Error seeding questions:", error);
            toast({
                title: "Erro ao popular perguntas",
                description: "Ocorreu um erro ao tentar salvar as perguntas no Firestore.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-8 flex justify-center items-center min-h-screen">
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle>Popular Banco de Perguntas Padrão</CardTitle>
                    <CardDescription>
                        Esta ação irá verificar e inserir as perguntas padrão do sistema
                        para o produto PulseCheck na coleção `pulse_check_questions`. 
                        Perguntas com o mesmo texto não serão duplicadas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSeed} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Populando...
                            </>
                        ) : (
                            "Executar Script de Semeação"
                        )}
                    </Button>
                    {result && (
                        <div className="mt-6 p-4 bg-muted rounded-lg text-center">
                            <h3 className="font-semibold">Resultado:</h3>
                            <p>{result.addedCount} novas perguntas adicionadas.</p>
                            <p>{result.skippedCount} perguntas ignoradas (já existiam).</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
