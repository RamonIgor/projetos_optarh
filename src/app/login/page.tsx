
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
            router.replace('/change-password');
        } else {
            router.replace('/');
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
      // The useEffect will handle the redirection, no need to do it here.
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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-white to-gray-100 flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 right-0 h-96 w-full opacity-[0.15] [mask-image:linear-gradient(to_bottom,white,transparent)]">
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#8b5cf6' }} />
              <stop offset="100%" style={{ stopColor: '#6366f1' }} />
            </linearGradient>
          </defs>
          <path d="M0,150 C150,300 350,-50 500,150 C650,350 850,-50 1000,150 L1000,0 L0,0 Z" fill="url(#wave-gradient)" transform="scale(2,1)"/>
        </svg>
      </div>
      
      <div className="relative z-10 w-full max-w-sm">
         <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <Image src="/optarh-logo.png" alt="OptaRH Logo" width={150} height={50} className="mx-auto" unoptimized />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
            <Card className="shadow-2xl">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-slate-800">Bem-vindo(a)!</CardTitle>
                <CardDescription className="text-slate-600">Acesse o portal de soluções.</CardDescription>
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
                    <Button type="submit" className="w-full h-12 text-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg transition-shadow" disabled={isSubmitting}>
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
    </div>
  );
}

