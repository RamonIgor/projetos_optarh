"use client";

import { motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ThankYouScreen() {

    const handleClose = () => {
        // First try to close the window/tab. This works if the tab was opened by a script.
        window.close();
        
        // If window.close() fails (which it often does for security reasons),
        // we redirect to a blank page as a fallback.
        // This gives the user a clear signal that the process is over.
        setTimeout(() => {
            window.location.href = 'about:blank';
        }, 100);
    }

    return (
        <div className="flex h-full flex-col items-center justify-center p-4">
             <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 20,
                    delay: 0.2,
                }}
             >
                <Card className="w-full max-w-lg text-center shadow-2xl">
                    <CardContent className="p-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                        >
                            <CheckCircle2 className="mx-auto h-20 w-20 text-green-500" />
                        </motion.div>
                        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
                            Obrigado pela sua participação!
                        </h1>
                        <p className="mt-4 text-lg text-muted-foreground">
                            Sua opinião é muito importante para nós e ajuda a construir um ambiente de trabalho cada vez melhor.
                        </p>
                    </CardContent>
                    <CardFooter className="bg-muted/50 p-4 justify-center">
                        <Button onClick={handleClose}>
                            <X className="mr-2 h-4 w-4" />
                            Fechar
                        </Button>
                    </CardFooter>
                </Card>
             </motion.div>
        </div>
    )
}
