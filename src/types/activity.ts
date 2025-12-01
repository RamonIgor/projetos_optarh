import type { Timestamp } from 'firebase/firestore';

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