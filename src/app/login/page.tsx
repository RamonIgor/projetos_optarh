"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  type AuthError
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

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

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;
    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error) {
      handleAuthError(error as AuthError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-sm shadow-2xl dark:shadow-black/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bem-vindo(a) ao CollabTask</CardTitle>
            <CardDescription>Entre ou crie uma conta para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Registrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleSignIn}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email-login">Email</Label>
                      <Input id="email-login" type="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password-login">Senha</Label>
                      <Input id="password-login" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full mt-2 h-11" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp}>
                   <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email-signup">Email</Label>
                      <Input id="email-signup" type="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password-signup">Senha</Label>
                      <Input id="password-signup" type="password" placeholder="Mínimo 6 caracteres" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full mt-2 h-11" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar Conta"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}