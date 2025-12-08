"use client";

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ThankYouScreen() {
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
                </Card>
             </motion.div>
        </div>
    )
}
