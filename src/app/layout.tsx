import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  title: 'ProcessFlow',
  description: 'Estruture o fluxo de trabalho do seu time, da ideia à rotina.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          'font-body antialiased min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-slate-900 dark:to-blue-950 flex flex-col'
        )}
      >
        <FirebaseClientProvider>
          <div className="flex-grow">{children}</div>
          <footer className="text-center py-4 text-sm text-muted-foreground">
            © 2025 Optarh. Todos os direitos reservados.
          </footer>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
