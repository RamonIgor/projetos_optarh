
"use client";

import { useState, useEffect, useMemo, Fragment } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useFirestore, useClient } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { type Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ThumbsUp, ActivitySquare, Square, Users, PieChart, CheckSquare, Clock, List, FileText, Edit, AlertCircle, CornerDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, Tooltip, Pie, Cell, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import type { CategoryChartData } from '@/components/CategoryChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CategoryChart = dynamic(() => import('@/components/CategoryChart'), {
    ssr: false,
    loading: () => <div className="h-[150px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
});


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

const statusConfig: Record<Activity['status'], { label: string, color: string }> = {
    brainstorm: { label: 'Não Classificada', color: 'bg-gray-200 text-gray-800' },
    aguardando_consenso: { label: 'Aguardando Consenso', color: 'bg-yellow-200 text-yellow-800' },
    aprovada: { label: 'Aprovada', color: 'bg-green-200 text-green-800' },
};

const categoryStyles: Record<string, string> = {
    DP: 'border-purple-200 bg-purple-50 text-purple-800',
    RH: 'border-green-200 bg-green-50 text-green-800',
    Compartilhado: 'border-blue-200 bg-blue-50 text-blue-800',
};


export default function DashboardPage() {
    const db = useFirestore();
    const { user, loading: userLoading } = useUser();
    const { clientId, isClientLoading } = useClient();
    const router = useRouter();

    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const isLoadingPage = userLoading || isClientLoading;

    useEffect(() => {
        if (isLoadingPage) {
            setIsLoading(true);
            return;
        }
        if (!user) {
            router.push('/login');
            return;
        }
        if (!db || !clientId) {
            setAllActivities([]);
            setIsLoading(false);
            return;
        }
        
        const q = query(
            collection(db, 'clients', clientId, 'activities')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setAllActivities(activitiesData);
            setIsLoading(false);
        }, () => setIsLoading(false));

        return () => unsubscribe();
    }, [db, user, router, clientId, isLoadingPage]);
    
    const mainActivities = useMemo(() => allActivities.filter(a => !a.parentId), [allActivities]);

    const filteredMainActivities = useMemo(() => {
        return mainActivities.filter(activity => {
            const categoryMatch = categoryFilter === 'all' || activity.categoria === categoryFilter;
            const statusMatch = statusFilter === 'all' || activity.status === statusFilter;
            return categoryMatch && statusMatch;
        });
    }, [mainActivities, categoryFilter, statusFilter]);

    const activitiesWithChildren = useMemo(() => {
        return filteredMainActivities.map(main => ({
            ...main,
            children: allActivities.filter(child => child.parentId === main.id)
        }));
    }, [filteredMainActivities, allActivities]);

    const stats = useMemo(() => {
        const total = mainActivities.length;
        const classified = mainActivities.filter(a => a.status !== 'brainstorm').length;
        const approved = mainActivities.filter(a => a.status === 'aprovada').length;

        const byCategory = mainActivities.reduce((acc, a) => {
            if (a.categoria) acc[a.categoria] = (acc[a.categoria] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byStatus = mainActivities.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byResponsible = mainActivities.reduce((acc, a) => {
            if (a.responsavel) acc[a.responsavel] = (acc[a.responsavel] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byRecurrence = mainActivities.reduce((acc, a) => {
            if (a.recorrencia) acc[a.recorrencia] = (acc[a.recorrencia] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const pendingDecision = mainActivities.filter(a => a.status === 'aguardando_consenso');
        const latestApproved = mainActivities
            .filter(a => a.status === 'aprovada' && a.dataAprovacao)
            .sort((a, b) => (b.dataAprovacao as any) - (a.dataAprovacao as any))
            .slice(0, 5);


        return { total, classified, approved, byCategory, byStatus, byResponsible, byRecurrence, pendingDecision, latestApproved };
    }, [mainActivities]);
    
    const categoryChartData: CategoryChartData[] = useMemo(() => [
        { name: 'DP', value: stats.byCategory['DP'] || 0, fill: '#6d28d9' },
        { name: 'RH', value: stats.byCategory['RH'] || 0, fill: '#16a34a' },
        { name: 'Compartilhado', value: stats.byCategory['Compartilhado'] || 0, fill: '#2563eb' }
    ].filter(item => item.value > 0), [stats.byCategory]);
    
    if (isLoadingPage || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] w-full">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (mainActivities.length === 0 && !isClientLoading) {
        return (
           <div className="text-center py-20 flex-1">
            <h1 className="mt-4 text-3xl font-bold">Nenhum dado para exibir</h1>
            <p className="mt-2 text-lg text-muted-foreground">Adicione e classifique atividades para ver o dashboard.</p>
            <Button onClick={() => router.push('/brainstorm')} className="mt-6">
              Ir para Brainstorm
            </Button>
          </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto w-full">
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
              <StatCard title="Total de Atividades Principais" value={stats.total} icon={<FileText />} className="lg:col-span-1">
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
          </div>
          
            <Card className="mt-8 shadow-lg">
                <CardHeader>
                    <CardTitle>Lista de Atividades</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50%]">Atividade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activitiesWithChildren.length > 0 ? (
                                activitiesWithChildren.map(activity => (
                                    <Fragment key={activity.id}>
                                    <TableRow>
                                        <TableCell className="font-medium">{activity.nome}</TableCell>
                                        <TableCell>
                                            {activity.categoria ? (
                                                <Badge variant="outline" className={cn(categoryStyles[activity.categoria])}>{activity.categoria}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(statusConfig[activity.status].color)}>{statusConfig[activity.status].label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="sm">
                                                <Link href={`/classificacao?activityId=${activity.id}`}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Classificar
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                     {activity.children.map(child => (
                                        <TableRow key={child.id} className="bg-muted/50">
                                            <TableCell className="pl-10">
                                                <div className="flex items-center gap-2">
                                                    <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">{child.nome}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell colSpan={3}></TableCell>
                                        </TableRow>
                                    ))}
                                    </Fragment>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8" />
                                            <span>Nenhuma atividade encontrada com os filtros selecionados.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
