"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { 
  signInWithEmailAndPassword,
  type AuthError,
  type User
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


const isFirstLogin = (user: User) => {
    const { creationTime, lastSignInTime } = user.metadata;
    if (!creationTime || !lastSignInTime) return false;

    const creation = new Date(creationTime).getTime();
    const lastSignIn = new Date(lastSignInTime).getTime();
    
    // Consider it the first login if the difference is less than a few seconds
    return Math.abs(creation - lastSignIn) < 5000; 
}


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
        if(isFirstLogin(user)) {
            router.push('/change-password');
        } else {
            router.push('/');
        }
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (isFirstLogin(userCredential.user)) {
          router.push('/change-password');
      } else {
          router.push('/');
      }
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
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <Image src="/optarh-logo.png" alt="OptaRH Logo" width={180} height={60} className="mx-auto" unoptimized />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bem-vindo(a) de volta!</CardTitle>
            <CardDescription>Acesse o portal de soluções.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="email-login">Email</Label>
                <Input
                  id="email-login"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-login">Senha</Label>
                <Input
                  id="password-login"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="h-11 text-base"
                />
              </div>

              <div>
                <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  Entrar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
