import type { Timestamp } from 'firebase/firestore';

export interface Client {
  id: string;
  name: string;
  logoUrl?: string | null;
  userIds: string[];
}

export interface UserProfile {
    clientId: string;
    products: string[];
    isConsultant: boolean;
    email?: string;
}

export interface ActivityComment {
  autor: string;
  texto: string;
  data: Timestamp | Date;
}

export interface Activity {
  id: string;
  nome: string;
  categoria: 'DP' | 'RH' | 'Compartilhado' | null;
  justificativa: string | null;
  responsavel: string | null;
  recorrencia: 'Diária' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual' | 'Sob demanda' | null;
  status: 'brainstorm' | 'aguardando_consenso' | 'aprovada';
  comentarios: ActivityComment[];
  dataAprovacao: Timestamp | Date | null;
  ultimaExecucao: Timestamp | Date | null;
  createdAt: Timestamp | Date;
  statusTransicao: 'a_transferir' | 'em_transicao' | 'concluida';
  responsavelAnterior: string | null;
  dataInicioTransicao: Timestamp | Date | null;
  dataConclusaoTransicao: Timestamp | Date | null;
  prazoTransicao: Timestamp | Date | null;
  historicoExecucoes?: (Timestamp | Date)[];
  parentId: string | null;
}

export interface ConsultancyAction {
    id: string;
    acao: string;
    como_sera_realizada: string;
    responsavel: string;
    data_inicio: Timestamp | Date;
    data_termino: Timestamp | Date;
    prazo_realizado: Timestamp | Date | null;
    percentual_concluido: number;
    percentual_planejado: number;
    status: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
    observacoes: string;
    createdAt: Timestamp | Date;
}


// --- PulseCheck Types ---

export interface Question {
  id: string;
  text: string;
  type: 'nps' | 'likert' | 'multiple-choice' | 'open-text';
  category: string;
  options?: string[] | null;
  order: number;
  isMandatory: boolean;
  isNpsQuestion?: boolean;
  isDefault?: boolean;
  createdBy: string; // UID of consultant or 'system'
  createdAt: Timestamp | Date;
}

export interface SelectedQuestion {
  id: string;
  questionId: string; // Reference to the original question in the library
  text: string;
  type: 'nps' | 'likert' | 'multiple-choice' | 'open-text';
  category: string;
  options?: string[] | null;
  isMandatory: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  clientId: string;
  status: 'draft' | 'active' | 'closed';
  questions: SelectedQuestion[]; // Changed from questionIds
  isAnonymous: boolean;
  createdAt: Timestamp | Date;
  opensAt: Timestamp | Date;
  closesAt: Timestamp | Date;
}

export interface Answer {
  questionText: string;
  answer: string | number;
}

export interface Response {
  id: string;
  surveyId: string;
  clientId: string;
  respondentId: string | null; // UID or null for anonymous
  answers: Record<string, Answer>; // Key is questionId
  submittedAt: Timestamp | Date;
}
