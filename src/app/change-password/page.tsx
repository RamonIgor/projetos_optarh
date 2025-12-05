
"use client";

import { useState, type FormEvent } from 'react';
import { updatePassword, type AuthError } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ title: "Usuário não autenticado.", variant: "destructive" });
        router.push('/login');
        return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
        toast({ title: "Senha muito curta.", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(user, newPassword);
      toast({
        title: "Senha alterada com sucesso!",
        description: "Você agora pode usar sua nova senha para fazer login.",
      });
      router.push('/');
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao alterar a senha.",
        description: authError.message || "Tente fazer login novamente e repita o processo.",
        variant: "destructive",
      });
      console.error("Password change error:", authError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 p-4">
        <div className="mb-8 flex flex-col items-center text-center">
            <Image src="/optarh-logo.png" alt="OptaRH Logo" width={180} height={60} unoptimized />
             <h1 className="text-3xl font-bold text-foreground mt-4">Crie sua nova senha</h1>
             <p className="mt-2 text-muted-foreground">Por segurança, defina uma senha pessoal para sua conta.</p>
        </div>
      <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.6 }}
         className="w-full max-w-md"
      >
        <Card>
            <CardHeader>
                <CardTitle>Olá, {user.email}!</CardTitle>
                <CardDescription>Defina sua nova senha de acesso abaixo.</CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-6" onSubmit={handleChangePassword}>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      required 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirme a Nova Senha</Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      required 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="h-11 text-base"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <Button type="button" variant="outline" className="w-full h-12 text-lg" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Voltar
                    </Button>
                    <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <KeyRound className="mr-2 h-5 w-5" />
                        )}
                      Salvar Nova Senha
                    </Button>
                  </div>
                </form>
            </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
