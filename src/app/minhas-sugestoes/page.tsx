
'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { type Suggestion } from '@/types/activity';
import { Loader2, ArrowLeft, Lightbulb, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<Suggestion['status'], { label: string; color: string; }> = {
  new: { label: 'Nova', color: 'bg-blue-100 text-blue-800' },
  in_review: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
  implemented: { label: 'Implementada', color: 'bg-green-100 text-green-800' },
  declined: { label: 'Recusada', color: 'bg-gray-100 text-gray-800' },
};

export default function MySuggestionsPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'system_suggestions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userSuggestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suggestion));
      setSuggestions(userSuggestions);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching suggestions:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user, userLoading, router]);

  if (isLoading || userLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Minhas Sugestões</h1>
            <p className="mt-1 text-lg text-muted-foreground">Acompanhe o status e as respostas das suas ideias.</p>
          </div>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <Card className="text-center py-20">
          <CardContent>
            <h2 className="text-2xl font-semibold">Nenhuma sugestão enviada</h2>
            <p className="mt-2 text-muted-foreground">Você ainda não enviou nenhuma sugestão. Suas ideias aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {suggestions.map((suggestion) => {
            const config = statusConfig[suggestion.status];
            return (
              <Card key={suggestion.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Sua sugestão</CardTitle>
                    <CardDescription>Enviada {formatDistanceToNow(suggestion.createdAt.toDate(), { locale: ptBR, addSuffix: true })}</CardDescription>
                  </div>
                  <Badge className={config.color}>{config.label}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="italic">"{suggestion.text}"</p>
                </CardContent>
                {suggestion.response && (
                  <CardFooter className="bg-muted/50 p-6">
                    <div className="w-full">
                        <div className="flex items-center gap-2 mb-2">
                           <MessageSquare className="h-5 w-5 text-primary" />
                           <h3 className="font-semibold text-foreground">Resposta do Consultor</h3>
                        </div>
                        <p className="text-sm text-muted-foreground italic">"{suggestion.response}"</p>
                    </div>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
