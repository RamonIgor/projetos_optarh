"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { 
  signInWithEmailAndPassword,
  type AuthError
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, loading } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleAuthError = (error: AuthError) => {
    let title = "Erro de Autenticação";
    let description = "Ocorreu um erro inesperado. Tente novamente.";
    
    switch (error.code) {
        case 'auth/invalid-email':
            title = "Email Inválido";
            description = "Por favor, insira um endereço de email válido.";
            break;
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
             title = "Credenciais Inválidas";
             description = "Email ou senha incorretos. Verifique e tente novamente.";
             break;
        case 'auth/email-already-in-use':
            title = "Email já cadastrado";
            description = "Este email já está em uso. Tente fazer login.";
            break;
        case 'auth/weak-password':
            title = "Senha Fraca";
            description = "A senha deve ter pelo menos 6 caracteres.";
            break;
        default:
            console.error("Authentication error:", error);
    }

    toast({
        variant: "destructive",
        title: title,
        description: description,
    });
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error) {
      handleAuthError(error as AuthError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full lg:grid lg:grid-cols-2">
       <div className="hidden bg-gradient-to-br from-primary to-purple-600 lg:flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="z-10"
          >
            <h1 className="text-5xl font-bold text-white">ProcessFlow</h1>
            <p className="mt-4 text-lg text-white/80">
              Estruture o fluxo de trabalho do seu time, da ideia à rotina.
            </p>
          </motion.div>
          <div className="absolute bottom-8 left-8 right-8 z-10 text-white/70 text-sm">
             Painel de gerenciamento de tarefas para equipes de DP e RH.
          </div>
      </div>
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Acesse sua conta
              </h2>
              <p className="mt-2 text-muted-foreground">
                Bem-vindo(a) de volta!
              </p>
            </div>
            
            <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
              <div className="space-y-4 rounded-md">
                <div>
                  <Label htmlFor="email-login" className="sr-only">Email</Label>
                  <Input 
                    id="email-login"
                    type="email" 
                    autoComplete="email"
                    required
                    placeholder="seu@email.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                   />
                </div>
                <div>
                  <Label htmlFor="password-login" className="sr-only">Senha</Label>
                  <Input 
                    id="password-login" 
                    type="password" 
                    autoComplete="current-password"
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <Button type="submit" className="group relative flex w-full justify-center py-3 text-lg" disabled={isSubmitting}>
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    )}
                  </span>
                  Entrar
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
