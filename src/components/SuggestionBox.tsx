"use client";

import { useState } from 'react';
import { useFirestore, useUser, useClient } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function SuggestionBox() {
  const db = useFirestore();
  const { user } = useUser();
  const { clientId } = useClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!suggestionText.trim()) {
      toast({ title: 'Por favor, escreva sua sugestão.', variant: 'destructive' });
      return;
    }
    if (!user) {
        toast({ title: 'Você precisa estar logado para enviar uma sugestão.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        text: suggestionText,
        userId: user.uid,
        userEmail: user.email,
        clientId: clientId,
        createdAt: serverTimestamp(),
        status: 'new',
      };
      await addDoc(collection(db, 'system_suggestions'), data);
      toast({ title: 'Sugestão enviada com sucesso!', description: 'Obrigado pelo seu feedback.' });
      setSuggestionText('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error sending suggestion:', error);
      toast({ title: 'Erro ao enviar sugestão.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Button
            size="icon"
            className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90"
            onClick={() => setIsOpen(true)}
            aria-label="Caixa de Sugestões"
          >
            <Lightbulb className="h-8 w-8" />
          </Button>
        </motion.div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Caixa de Sugestões
            </DialogTitle>
            <DialogDescription>
              Tem uma ideia para melhorar o sistema? Nos diga! Seu feedback é muito importante.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Descreva sua sugestão aqui..."
              rows={6}
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !suggestionText.trim()}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar Sugestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
