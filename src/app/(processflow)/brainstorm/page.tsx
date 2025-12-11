
"use client";

import { useState, useEffect, useTransition, FormEvent, useMemo, useRef } from 'react';
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type Activity } from '@/types/activity';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Loader2, ThumbsUp, ActivitySquare, Square, GitBranchPlus, Calendar as CalendarIcon, Paperclip, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFirestore, useClient, useFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';


// Simple similarity check
const isSimilar = (a: string, b: string) => {
  const cleanA = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const cleanB = b.toLowerCase().trim().replace(/\s+/g, ' ');
  return cleanA === cleanB;
};

const statusInfo: { [key: string]: { label: string; icon: React.ReactNode; variant: "secondary" | "default" | "destructive" | "outline" | null | undefined, className: string } } = {
  brainstorm: { label: 'Não classificada', icon: <Square className="h-3 w-3" />, variant: 'secondary', className: '' },
  aguardando_consenso: { label: 'Aguardando consenso', icon: <ActivitySquare className="h-3 w-3" />, variant: 'secondary', className: 'bg-yellow-100 text-yellow-800' },
  aprovada: { label: 'Aprovada', icon: <ThumbsUp className="h-3 w-3" />, variant: 'secondary', className: 'bg-green-100 text-green-800' },
};

function AddSubActivityForm({ parentId, onAddSubActivity, onFinished }: { parentId: string; onAddSubActivity: (name: string, parentId: string, responsavel: string, recorrencia: string, prazo: Date | undefined, file: File | null) => void; onFinished: () => void; }) {
    const [subActivityName, setSubActivityName] = useState("");
    const [responsavel, setResponsavel] = useState("");
    const [recorrencia, setRecorrencia] = useState("");
    const [prazo, setPrazo] = useState<Date | undefined>();
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAdding, startAdding] = useTransition();

    const handleAddSubmit = (e: FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!subActivityName.trim() || !responsavel.trim() || !recorrencia) return;
        if(recorrencia === 'Sob demanda' && !prazo) return;

        startAdding(() => {
            onAddSubActivity(subActivityName, parentId, responsavel, recorrencia, prazo, file);
            setSubActivityName("");
            setResponsavel("");
            setRecorrencia("");
            setPrazo(undefined);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onFinished(); // Call the callback to close the form
        });
    }

    return (
        <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
        >
            <form onSubmit={handleAddSubmit} className="space-y-3 p-4 bg-card border rounded-lg ml-6 mt-4">
                <h4 className="font-semibold text-sm">Adicionar Micro-processo</h4>
                <Input
                    type="text" placeholder="Nome do micro-processo"
                    value={subActivityName} onChange={(e) => setSubActivityName(e.target.value)}
                    className="h-9" disabled={isAdding} onClick={(e) => e.stopPropagation()}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     <Input
                        type="text" placeholder="Responsável"
                        value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
                        className="h-9" disabled={isAdding} onClick={(e) => e.stopPropagation()}
                    />
                    <Select value={recorrencia} onValueChange={setRecorrencia} disabled={isAdding}>
                        <SelectTrigger className="h-9" onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Recorrência" />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                            <SelectItem value="Diária">Diária</SelectItem>
                            <SelectItem value="Semanal">Semanal</SelectItem>
                            <SelectItem value="Mensal">Mensal</SelectItem>
                            <SelectItem value="Trimestral">Trimestral</SelectItem>
                            <SelectItem value="Semestral">Semestral</SelectItem>
                            <SelectItem value="Anual">Anual</SelectItem>
                            <SelectItem value="Sob demanda">Sob demanda</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {recorrencia === 'Sob demanda' && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                        >
                            <Label className="text-xs">Prazo de Conclusão (Obrigatório)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("h-9 w-full justify-start text-left font-normal", !prazo && "text-muted-foreground")}
                                        disabled={isAdding} onClick={(e) => e.stopPropagation()}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {prazo ? format(prazo, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
                                    <Calendar mode="single" selected={prazo} onSelect={setPrazo} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </motion.div>
                 )}
                  <div className="space-y-2">
                      <Label className="text-xs">Anexo (Opcional)</Label>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="sub-attachment" className="flex-shrink-0 cursor-pointer">
                                <div className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "h-9")}>
                                <Paperclip className="mr-2 h-4 w-4" /> Anexar
                                </div>
                            </Label>
                            <Input id="sub-attachment" type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="hidden" disabled={isAdding} />
                            {file && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-1.5 rounded-md">
                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                 </div>
                <Button type="submit" size="sm" className="h-9 w-full" disabled={isAdding || !subActivityName.trim() || !responsavel.trim() || !recorrencia || (recorrencia === 'Sob demanda' && !prazo)}>
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" /> Adicionar</>}
                </Button>
            </form>
        </motion.div>
    )
}


function ActivityItem({ activity, isSubItem = false, hasChildren = false, onAddSubActivity, onDeleteActivity }: { activity: Activity, isSubItem?: boolean, hasChildren?: boolean, onAddSubActivity: (name: string, parentId: string, responsavel: string, recorrencia: string, prazo: Date | undefined, file: File | null) => void, onDeleteActivity: (id: string) => void }) {
    const [showAddSub, setShowAddSub] = useState(false);
    const [isDeleting, startDeleting] = useTransition();

    const status = statusInfo[activity.status] || statusInfo.brainstorm;
    const isDeletable = (activity.status === 'brainstorm' || activity.parentId) && !hasChildren;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        startDeleting(() => {
            onDeleteActivity(activity.id);
        })
    }

    const deleteButton = (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed" 
            onClick={handleDelete} 
            disabled={isDeleting || !isDeletable} 
            aria-label={`Excluir ${activity.nome}`}
        >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
    );

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn("p-3 rounded-lg", isSubItem ? "ml-8 bg-card border" : "bg-muted/50")}
        >
             <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", isSubItem ? "text-muted-foreground" : "text-foreground")}>{activity.nome}</span>
                      {activity.attachmentUrl && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href={activity.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                        <Paperclip className="h-4 w-4 text-primary cursor-pointer" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver anexo: {activity.attachmentFilename}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                     {isSubItem && activity.responsavel && (
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                            <span>Responsável: {activity.responsavel}</span>
                            {activity.recorrencia && <span>| Recorrência: {activity.recorrencia}</span>}
                            {activity.prazo && <span>| Prazo: {format((activity.prazo as any).toDate(), 'dd/MM/yyyy')}</span>}
                        </div>
                     )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {!isSubItem && (
                        <Badge variant={status.variant} className={status.className}>
                            <div className="flex items-center gap-1.5">
                                {status.icon}
                                {status.label}
                            </div>
                        </Badge>
                    )}
                     {!isSubItem && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost" size="icon" className="h-8 w-8"
                                        onClick={(e) => { e.stopPropagation(); setShowAddSub(!showAddSub); }}
                                        aria-label="Adicionar micro-processo"
                                    >
                                        <GitBranchPlus className="h-4 w-4"/>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Adicionar micro-processo</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    
                    {hasChildren ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>{deleteButton}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Exclua os micro-processos primeiro para poder apagar a atividade principal.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        deleteButton
                    )}
                </div>
            </div>
            <AnimatePresence>
                {showAddSub && <AddSubActivityForm parentId={activity.id} onAddSubActivity={onAddSubActivity} onFinished={() => setShowAddSub(false)} />}
            </AnimatePresence>
        </motion.div>
    )
}

export default function BrainstormPage() {
  const db = useFirestore();
  const { app } = useFirebase();
  const storage = app ? getStorage(app) : null;
  const { user, loading: userLoading } = useUser();
  const { clientId, isClientLoading, isConsultant } = useClient();
  const router = useRouter();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivityName, setNewActivityName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, startMainAddTransition] = useTransition();

  const [dialogState, setDialogState] = useState<{ open: boolean; similarTo?: string; nameToAdd?: string; }>({ open: false });
  
  const { toast } = useToast();

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login');
        }
    }, [user, userLoading, router]);

  useEffect(() => {
    const pageIsLoading = userLoading || isClientLoading;
    if (pageIsLoading) return;
    
    if (!db) {
        setIsLoading(false);
        return;
    }
    
    if (!clientId) {
        setActivities([]);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    const activitiesCollectionRef = collection(db, 'clients', clientId, 'activities');
    const q = query(activitiesCollectionRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const activitiesData: Activity[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(activitiesData);
      setIsLoading(false);
    }, 
    async (error) => {
      const permissionError = new FirestorePermissionError({ path: activitiesCollectionRef.path, operation: 'list' });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        title: "Erro ao carregar atividades",
        description: "Houve um problema ao buscar os dados. Verifique as permissões de leitura.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, toast, user, userLoading, router, clientId, isClientLoading]);
  
  const mainActivities = useMemo(() => activities.filter(a => !a.parentId), [activities]);
  
  const activityTree = useMemo(() => {
    const tree: (Activity & { children: Activity[] })[] = [];
    const childrenOf: Record<string, Activity[]> = {};
    const activityMap = new Map(activities.map(a => [a.id, a]));

    activities.forEach(activity => {
        if (activity.parentId) {
            if (!childrenOf[activity.parentId]) {
                childrenOf[activity.parentId] = [];
            }
            childrenOf[activity.parentId].push(activity);
        }
    });
    
    mainActivities.forEach(activity => {
        const children = (childrenOf[activity.id] || []).sort((a,b) => ((a.createdAt as any)?.seconds || 0) - ((b.createdAt as any)?.seconds || 0));
        tree.push({ ...activity, children });
    });
    
    tree.sort((a,b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));

    return tree;
  }, [activities, mainActivities]);


  const addActivity = async (name: string, parentId: string | null = null, responsavel: string | null = null, recorrencia: string | null = null, prazo: Date | undefined = undefined, fileToAdd: File | null = null) => {
    const trimmedName = name.trim();
    if (!trimmedName || !db || !clientId || !storage) return;
    
    let attachmentUrl: string | null = null;
    let attachmentFilename: string | null = null;

    if (fileToAdd) {
        const uniqueFilename = `${Date.now()}-${fileToAdd.name}`;
        const fileRef = storageRef(storage, `attachments/${clientId}/${uniqueFilename}`);
        try {
            const snapshot = await uploadBytes(fileRef, fileToAdd);
            attachmentUrl = await getDownloadURL(snapshot.ref);
            attachmentFilename = fileToAdd.name;
        } catch (uploadError) {
            console.error("File upload error:", uploadError);
            toast({
                title: "Erro no Upload",
                description: "Não foi possível anexar o arquivo.",
                variant: "destructive",
            });
            // Stop if upload fails
            return; 
        }
    }


    let parentActivity: Activity | undefined;
    if (parentId) {
        parentActivity = activities.find(a => a.id === parentId);
    }
    
    if(!parentId) {
        setNewActivityName("");
        setFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
    
    const activityData: any = {
        nome: trimmedName,
        parentId: parentId,
        categoria: parentId && parentActivity ? parentActivity.categoria : null,
        justificativa: parentId ? 'Micro-processo de uma atividade principal.' : null,
        responsavel: responsavel,
        recorrencia: recorrencia as Activity['recorrencia'],
        status: parentId ? 'aprovada' : 'brainstorm',
        comentarios: [],
        dataAprovacao: parentId ? serverTimestamp() : null,
        ultimaExecucao: null,
        createdAt: serverTimestamp(),
        statusTransicao: parentId ? 'concluida' : 'a_transferir',
        responsavelAnterior: null,
        dataInicioTransicao: null,
        dataConclusaoTransicao: parentId ? serverTimestamp() : null,
        prazoTransicao: null,
        prazo: prazo || null,
        historicoExecucoes: [],
        attachmentUrl,
        attachmentFilename,
      };

      const activitiesCollection = collection(db, 'clients', clientId, 'activities');
      addDoc(activitiesCollection, activityData)
        .catch(async (error) => {
          if (!parentId) setNewActivityName(name); // Restore input on error for main activity
          const permissionError = new FirestorePermissionError({
            path: activitiesCollection.path,
            operation: 'create',
            requestResourceData: activityData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            title: "Erro ao adicionar atividade",
            description: "Não foi possível salvar a nova atividade. Verifique as permissões.",
            variant: "destructive",
          });
        });
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newActivityName.trim();
    if (!trimmedName || isAdding) return;
    
    startMainAddTransition(() => {
        const similar = mainActivities.find(act => isSimilar(act.nome, trimmedName));
        if (similar) {
          setDialogState({ open: true, similarTo: similar.nome, nameToAdd: trimmedName });
        } else {
          addActivity(trimmedName, null, null, null, undefined, file);
        }
    });
  };

  const handleConfirmAdd = () => {
    if (dialogState.nameToAdd) {
      addActivity(dialogState.nameToAdd, null, null, null, undefined, file);
    }
    setDialogState({ open: false });
  };

  const handleDeleteActivity = (id: string) => {
    if (!db || !clientId) return;
    
    const activityToDelete = activities.find(a => a.id === id);
    if (!activityToDelete) return;

    // Note: This does not delete the file from storage. A more robust implementation
    // would require a Cloud Function to handle deletions.
    const docRef = doc(db, 'clients', clientId, 'activities', id);
    deleteDoc(docRef)
    .catch(async (error) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        toast({
        title: "Erro ao excluir atividade",
        description: "Não foi possível excluir a atividade. Verifique as permissões.",
        variant: "destructive",
        });
    });
  };
    
  const isLoadingPage = userLoading || (isClientLoading && !isConsultant);

  if (isLoadingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  const showConsultantPrompt = isConsultant && !clientId;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-bold text-center text-primary tracking-tight">Brainstorm de Atividades</h1>
        <p className="mt-4 text-lg text-center text-muted-foreground">Liste todas as atividades e seus micro-processos. Não se preocupe com a classificação ainda.</p>
      </motion.div>

      <Card className="mt-8 shadow-lg dark:shadow-black/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div>
              <CardTitle className="text-xl">Adicionar Nova Atividade Principal</CardTitle>
            </div>
            <div className="text-sm font-medium text-muted-foreground pt-1 shrink-0">{mainActivities.length} atividades levantadas</div>
          </div>
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col sm:flex-row gap-2 items-start">
                <div className="w-full flex-grow space-y-2">
                    <Input
                        type="text"
                        placeholder="Ex: Processar folha de pagamento"
                        value={newActivityName}
                        onChange={(e) => setNewActivityName(e.target.value)}
                        className="h-12 text-base"
                        disabled={isAdding || !clientId}
                        aria-label="Nova atividade principal"
                    />
                    <div className="flex items-center gap-2">
                        <Label htmlFor="main-attachment" className="flex-shrink-0 cursor-pointer">
                           <div className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "h-9")}>
                               <Paperclip className="mr-2 h-4 w-4"/> Anexo (Opcional)
                           </div>
                        </Label>
                        <Input id="main-attachment" type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="hidden" disabled={isAdding || !clientId} />
                        {file && (
                             <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-1.5 rounded-md">
                                <span className="truncate max-w-[200px]">{file.name}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
               <Button type="submit" size="lg" className="h-12 w-full sm:w-auto flex-shrink-0" disabled={isAdding || !newActivityName.trim() || !clientId}>
                  {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5 sm:mr-2" />}
                  <span className="hidden sm:inline">Adicionar</span>
               </Button>
            </div>
          </form>
            {showConsultantPrompt && (
              <p className="text-sm text-yellow-600 mt-2">Como consultor(a), por favor, selecione um cliente no Painel de Consultoria para começar a adicionar atividades.</p>
            )}
            {!clientId && !isConsultant && !isClientLoading && (
                <p className="text-sm text-destructive mt-2">Sua conta não está associada a um cliente. Não é possível adicionar atividades.</p>
            )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            ) : activityTree.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-semibold">Tudo limpo por aqui!</h3>
                <p className="mt-1 text-muted-foreground">
                  {showConsultantPrompt
                      ? "Selecione um cliente para ver as atividades."
                      : "Comece a adicionar as atividades da sua equipe no campo acima."}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                <AnimatePresence>
                  {activityTree.map((activity) => (
                      <div key={activity.id}>
                          <ActivityItem 
                              activity={activity} 
                              onAddSubActivity={addActivity}
                              onDeleteActivity={handleDeleteActivity}
                              hasChildren={activity.children.length > 0}
                          />
                            {activity.children.length > 0 && (
                              <div className="space-y-2 mt-2">
                                  {activity.children.map(child => (
                                        <ActivityItem 
                                          key={child.id}
                                          activity={child}
                                          isSubItem={true}
                                          onAddSubActivity={addActivity}
                                          onDeleteActivity={handleDeleteActivity}
                                      />
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={dialogState.open} onOpenChange={(open) => setDialogState({ ...dialogState, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atividade Similar Encontrada</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma atividade chamada "{dialogState.similarTo}". Deseja adicionar "{dialogState.nameToAdd}" mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialogState({ open: false })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAdd}>Sim, adicionar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
