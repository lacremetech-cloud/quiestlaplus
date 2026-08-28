/** Types partages entre le serveur et les deux clients (hote + telephone). */

export type Phase =
  | 'lobby'
  | 'voting'
  | 'locked'
  | 'countdown'
  | 'result'
  | 'finished';

export interface Participant {
  /** Identifiant stable de la participante dans la partie. */
  id: string;
  name: string;
}

/** Vue "lobby" d'une participante cote hote. */
export interface RosterEntry extends Participant {
  /** true si un telephone a reserve ce prenom. */
  claimed: boolean;
  /** true si ce telephone est actuellement connecte. */
  online: boolean;
}

export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
  /** Emoji d'ambiance affiche sur l'ecran projete. */
  emoji: string;
  /** Templates de commentaires specifiques a cette question. */
  templates: string[];
}

export type QuestionCategory = 'perso' | 'projection' | 'scenario' | 'humour';

export interface PodiumRow {
  participantId: string;
  name: string;
  votes: number;
  percent: number;
  /** 1, 2 ou 3 — les ex aequo partagent le meme rang. */
  rank: number;
}

export type ResultStrength =
  | 'tie'
  | 'landslide'
  | 'close'
  | 'scattered'
  | 'normal';

export interface RoundResult {
  questionId: string;
  questionText: string;
  totalVotes: number;
  /** Toutes les gagnantes (plusieurs en cas d'egalite). */
  winners: PodiumRow[];
  /** Top 3 rangs, ex aequo inclus. */
  podium: PodiumRow[];
  strength: ResultStrength;
  /** Phrase d'ambiance liee a la force du resultat (peut etre vide). */
  strengthLine: string;
  /** Commentaire drole specifique a la question. */
  comment: string;
}

export interface FinalStats {
  totalVotes: number;
  questionsPlayed: number;
  /** Celles qui ont gagne le plus de questions (ex aequo possibles). */
  queens: { name: string; wins: number }[];
  /** Celles qui ont recu le plus de votes au total (ex aequo possibles). */
  mostCited: { name: string; votes: number }[];
  closingLine: string;
}

/** Snapshot envoye a l'ecran projete. */
export interface HostState {
  code: string;
  joinUrl: string;
  qrDataUrl: string;
  phase: Phase;
  roster: RosterEntry[];
  connectedCount: number;
  questionIndex: number;
  totalQuestions: number;
  question: { id: string; text: string; emoji: string } | null;
  choices: Participant[];
  votesReceived: number;
  /** Nombre de participantes attendues pour la question en cours. */
  expectedVoters: number;
  result: RoundResult | null;
  finalStats: FinalStats | null;
}

/** Snapshot envoye a un telephone. */
export interface PlayerState {
  code: string;
  phase: Phase;
  /** Prenoms encore disponibles a la selection. */
  availableNames: Participant[];
  me: Participant | null;
  question: { id: string; text: string; emoji: string } | null;
  choices: Participant[];
  /** Choix deja effectue pour la question en cours (null sinon). */
  myVote: string | null;
  votesReceived: number;
  expectedVoters: number;
  result: RoundResult | null;
  finalStats: FinalStats | null;
}

export interface JoinPayload {
  code: string;
  deviceId: string;
}

export type Ack<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };
