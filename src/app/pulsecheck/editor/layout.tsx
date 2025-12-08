"use client";

import { Button } from "@/components/ui/button";
import { Ban, ArrowLeft } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

export default function SurveyEditorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const params = useParams();

    const handleBack = () => {
        if (params.step === 'review') {
            router.push(`/pulsecheck/editor/${params.surveyId}/questions`);
        } else if (params.step === 'questions') {
            router.push(`/pulsecheck/editor/${params.surveyId}`);
        } else {
            router.push('/pulsecheck');
        }
    }

    return (
        <div className="w-full pb-20">
            {children}
            <footer className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-sm border-t p-4">
                <div className="container mx-auto flex justify-between">
                     <Button type="button" variant="ghost" onClick={handleBack} disabled={!params.surveyId || params.surveyId === 'novo'}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                     <Button type="button" variant="ghost" onClick={() => router.push('/pulsecheck')}>
                        <Ban className="mr-2 h-4 w-4" />
                        Cancelar e Sair
                    </Button>
                </div>
            </footer>
        </div>
    );
}
