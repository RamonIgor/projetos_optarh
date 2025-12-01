"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ThumbsUp, ActivitySquare, Square, Users, PieChart, CheckSquare, Clock, List, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, Tooltip, Pie, Cell, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import type { CategoryChartData } from '@/components/CategoryChart';

const CategoryChart = dynamic(() => import('@/components/CategoryChart'), {
    ssr: false,
    loading: () => <div className="h-[150px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
});


const ACTIVITIES_COLLECTION = 'rh-dp-activities';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const StatCard = ({ title, value, icon, color, children, className }: { title: string, value: string | number, icon: React.ReactNode, color?: string, children?: React.ReactNode, className?: string }) => (
    <Card className={cn("shadow-lg", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <div className={cn("h-6 w-6", color)}>{icon}</div>
        </CardHeader>
        <CardContent>
            <div className="text-4xl font-bold">{value}</div>
            {children}
        </CardContent>
    </Card>
);

export default function DashboardPage() {
    const db = useFirestore();
    const { user, loading: userLoading } = useUser();
    const router = useRouter();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (userLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (!db) {
            setIsLoading(false);
            return;
        }

        const q = query(collection(db, ACTIVITIES_COLLECTION), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setAllActivities(activitiesData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user, userLoading, router]);

    const filteredActivities = useMemo(() => {
        return allActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'all' || activity.categoria === categoryFilter;
            const statusMatch = statusFilter === 'all' || activity.status === statusFilter;
            return categoryMatch && statusMatch;
        });
    }, [allActivities, categoryFilter, statusFilter]);

    const unclassifiedCount = useMemo(() => allActivities.filter(a => a.status === 'brainstorm' || a.status === 'aguardando_consenso').length, [allActivities]);

    const stats = useMemo(() => {
        const total = filteredActivities.length;
        const classified = filteredActivities.filter(a => a.status !== 'brainstorm').length;
        const approved = filteredActivities.filter(a => a.status === 'aprovada').length;

        const byCategory = filteredActivities.reduce((acc, a) => {
            if (a.categoria) acc[a.categoria] = (acc[a.categoria] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byStatus = filteredActivities.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byResponsible = filteredActivities.reduce((acc, a) => {
            if (a.responsavel) acc[a.responsavel] = (acc[a.responsavel] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byRecurrence = filteredActivities.reduce((acc, a) => {
            if (a.recorrencia) acc[a.recorrencia] = (acc[a.recorrencia] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const pendingDecision = allActivities.filter(a => a.status === 'aguardando_consenso');
        const latestApproved = allActivities
            .filter(a => a.status === 'aprovada' && a.dataAprovacao)
            .sort((a, b) => (b.dataAprovacao as any) - (a.dataAprovacao as any))
            .slice(0, 5);


        return { total, classified, approved, byCategory, byStatus, byResponsible, byRecurrence, pendingDecision, latestApproved };
    }, [filteredActivities, allActivities]);

    const categoryChartData: CategoryChartData[] = useMemo(() => [
        { name: 'DP', value: stats.byCategory['DP'] || 0, fill: 'hsl(var(--primary))' },
        { name: 'RH', value: stats.byCategory['RH'] || 0, fill: '#16a34a' },
        { name: 'Compartilhado', value: stats.byCategory['Compartilhado'] || 0, fill: '#2563eb' }
    ].filter(item => item.value > 0), [stats.byCategory]);
    
    if (userLoading || isLoading) {
        return (
            <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }
    
    if (allActivities.length === 0) {
        return (
           <AppLayout unclassifiedCount={0} hasActivities={false}>
            <div className="text-center py-20">
              <h1 className="mt-4 text-3xl font-bold">Nenhum dado para exibir</h1>
              <p className="mt-2 text-lg text-muted-foreground">Adicione e classifique atividades para ver o dashboard.</p>
              <Button onClick={() => router.push('/')} className="mt-6">
                Ir para Brainstorm
              </Button>
            </div>
          </AppLayout>
        )
    }

    return (
        <AppLayout unclassifiedCount={unclassifiedCount} hasActivities={allActivities.length > 0}>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Visão Geral do Projeto</h1>
            </motion.div>

            <div className="my-8 flex flex-col sm:flex-row gap-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrar por categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Categorias</SelectItem>
                        <SelectItem value="DP">DP</SelectItem>
                        <SelectItem value="RH">RH</SelectItem>
                        <SelectItem value="Compartilhado">Compartilhado</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="aprovada">Aprovadas</SelectItem>
                        <SelectItem value="aguardando_consenso">Aguardando Consenso</SelectItem>
                        <SelectItem value="brainstorm">Não Classificadas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Progresso do Levantamento" value={stats.total} icon={<FileText />} className="lg:col-span-1">
                    <p className="text-xs text-muted-foreground mt-2">
                        {stats.classified} classificadas, {stats.approved} aprovadas.
                    </p>
                    <Progress value={(stats.approved / (stats.total || 1)) * 100} className="mt-2 h-2" />
                </StatCard>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-md font-medium text-muted-foreground flex items-center gap-2"><PieChart className="h-5 w-5" />Divisão por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {categoryChartData.length > 0 ? (
                           <CategoryChart data={categoryChartData} />
                        ) : <p className="text-center text-sm text-muted-foreground py-10">Nenhum dado na categoria selecionada</p>}
                    </CardContent>
                </Card>

                <StatCard title="Status de Aprovação" value={stats.approved} icon={<CheckSquare />} color="text-green-500">
                    <p className="text-xs text-muted-foreground mt-2">
                        <span className="text-yellow-500">{stats.byStatus['aguardando_consenso'] || 0} aguardando</span>, {' '}
                        <span className="text-gray-500">{stats.byStatus['brainstorm'] || 0} não classificadas</span>
                    </p>
                </StatCard>

                <Card className="shadow-lg">
                     <CardHeader>
                        <CardTitle className="text-md font-medium text-muted-foreground flex items-center gap-2"><Users className="h-5 w-5" />Atividades por Responsável</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto">
                        <ul className="space-y-2 text-sm">
                            {Object.entries(stats.byResponsible).sort(([, a], [, b]) => b - a).map(([name, count]) => (
                                <li key={name} className="flex justify-between items-center">
                                    <span>{name}</span>
                                    <Badge variant="secondary">{count}</Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
                
                 <Card className="shadow-lg">
                     <CardHeader>
                        <CardTitle className="text-md font-medium text-muted-foreground flex items-center gap-2"><Clock className="h-5 w-5" />Recorrência</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto">
                        <ul className="space-y-2 text-sm">
                            {Object.entries(stats.byRecurrence).map(([name, count]) => (
                                <li key={name} className="flex justify-between items-center">
                                    <span>{name}</span>
                                    <Badge variant="secondary">{count}</Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 mt-8">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><ActivitySquare className="text-yellow-500"/> Atividades Pendentes de Decisão</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {stats.pendingDecision.length > 0 ? (
                            <ul className="space-y-2">
                                {stats.pendingDecision.map(activity => (
                                    <li key={activity.id}>
                                       <Link href={`/classificacao?activityId=${activity.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                            <span className="font-medium">{activity.nome}</span>
                                            <Badge variant="outline" className="text-yellow-600 border-yellow-500">{activity.categoria}</Badge>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                         ) : <p className="text-center text-sm text-muted-foreground py-6">Nenhuma atividade pendente!</p>}
                    </CardContent>
                </Card>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><ThumbsUp className="text-green-500" /> Últimas Aprovações</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {stats.latestApproved.length > 0 ? (
                            <ul className="space-y-2">
                                {stats.latestApproved.map(activity => (
                                    <li key={activity.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                        <span className="font-medium">{activity.nome}</span>
                                        <span className="text-sm text-muted-foreground">
                                            {format((activity.dataAprovacao as any).toDate(), "dd/MM/yyyy 'às' HH:mm")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                         ) : <p className="text-center text-sm text-muted-foreground py-6">Nenhuma atividade aprovada ainda.</p>}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
