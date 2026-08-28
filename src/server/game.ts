import { QUESTIONS, DEMO_NAMES } from '../shared/questions.ts';
import { Rotation, type Rng } from '../shared/rotation.ts';
import {
  podiumOf,
  strengthOf,
  tallyVotes,
  winnersOf,
} from '../shared/results.ts';
import { generateComment, pickClosingLine } from '../shared/comments.ts';
import type {
  FinalStats,
  HostState,
  Participant,
  Phase,
  PlayerState,
  Question,
  RosterEntry,
  RoundResult,
} from '../shared/types.ts';

export const MAX_PARTICIPANTS = 40;
const MAX_NAME_LENGTH = 24;

export interface RoomOptions {
  code: string;
  joinUrl: string;
  qrDataUrl: string;
  rng?: Rng;
  questions?: Question[];
}

/**
 * Melange les styles de questions : on alterne les categories en round-robin
 * pour ne jamais enchainer 5 scenarios d'affilee.
 */
export function buildQuestionOrder(
  questions: Question[],
  rng: Rng = Math.random,
): Question[] {
  const byCategory = new Map<string, Question[]>();
  for (const q of questions) {
    const list = byCategory.get(q.category);
    if (list) list.push(q);
    else byCategory.set(q.category, [q]);
  }

  const buckets = [...byCategory.values()].map((list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = copy[i] as Question;
      copy[i] = copy[j] as Question;
      copy[j] = a;
    }
    return copy;
  });

  const order: Question[] = [];
  let guard = 0;
  while (order.length < questions.length && guard++ < questions.length * 4) {
    // On pioche a chaque tour dans la categorie la plus fournie restante,
    // ce qui repartit naturellement les styles sur toute la partie.
    buckets.sort((a, b) => b.length - a.length);
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (next) order.push(next);
    }
  }
  return order;
}

export function sanitizeNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
    if (name.length === 0) continue;
    const key = name.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_PARTICIPANTS) break;
  }
  return out;
}

interface RoundRecord {
  questionId: string;
  winners: string[];
  votesByParticipant: Map<string, number>;
  totalVotes: number;
}

export class Room {
  readonly code: string;
  readonly joinUrl: string;
  readonly qrDataUrl: string;
  createdAt = Date.now();
  lastActivityAt = Date.now();

  private readonly rng: Rng;
  private readonly rotation: Rotation;
  private readonly allQuestions: Question[];

  private phase: Phase = 'lobby';
  private roster: Participant[] = [];
  private nextParticipantSeq = 1;

  /** participantId -> deviceId (prenom reserve par un telephone). */
  private claims = new Map<string, string>();
  /** deviceId -> participantId. */
  private devices = new Map<string, string>();
  /** deviceIds actuellement connectes. */
  private online = new Set<string>();

  private order: Question[] = [];
  private questionIndex = -1;
  private choices: Participant[] = [];
  private votes = new Map<string, string>();
  private result: RoundResult | null = null;
  private history: RoundRecord[] = [];
  private finalStats: FinalStats | null = null;

  constructor(options: RoomOptions) {
    this.code = options.code;
    this.joinUrl = options.joinUrl;
    this.qrDataUrl = options.qrDataUrl;
    this.rng = options.rng ?? Math.random;
    this.allQuestions = options.questions ?? QUESTIONS;
    this.rotation = new Rotation(this.rng);
    this.setRoster(DEMO_NAMES);
  }

  // ---------------------------------------------------------------- roster

  /**
   * Remplace la liste des prenoms (uniquement avant le lancement).
   * Les prenoms conserves gardent leur id, donc les telephones deja connectes
   * ne perdent pas leur place.
   */
  setRoster(names: string[]): void {
    if (this.phase !== 'lobby') return;
    const clean = sanitizeNames(names);
    const byName = new Map(
      this.roster.map((p) => [p.name.toLocaleLowerCase('fr'), p]),
    );

    const next: Participant[] = [];
    for (const name of clean) {
      const existing = byName.get(name.toLocaleLowerCase('fr'));
      if (existing) {
        existing.name = name;
        next.push(existing);
      } else {
        next.push({ id: `p${this.nextParticipantSeq++}`, name });
      }
    }

    const keptIds = new Set(next.map((p) => p.id));
    for (const [participantId, deviceId] of [...this.claims]) {
      if (!keptIds.has(participantId)) {
        this.claims.delete(participantId);
        this.devices.delete(deviceId);
      }
    }

    this.roster = next;
    this.rotation.reset();
    this.touch();
  }

  getRoster(): Participant[] {
    return this.roster.map((p) => ({ ...p }));
  }

  /** Un telephone reserve un prenom. Idempotent pour un meme appareil. */
  claim(deviceId: string, participantId: string): { ok: true } | { ok: false; error: string } {
    const participant = this.roster.find((p) => p.id === participantId);
    if (!participant) return { ok: false, error: 'Ce prénom n’existe plus.' };

    const owner = this.claims.get(participantId);
    if (owner && owner !== deviceId) {
      return { ok: false, error: 'Ce prénom est déjà pris.' };
    }

    const previous = this.devices.get(deviceId);
    if (previous && previous !== participantId) {
      if (this.phase !== 'lobby') {
        return { ok: false, error: 'Impossible de changer de prénom en cours de partie.' };
      }
      this.claims.delete(previous);
    }

    this.claims.set(participantId, deviceId);
    this.devices.set(deviceId, participantId);
    this.touch();
    return { ok: true };
  }

  participantOf(deviceId: string): Participant | null {
    const id = this.devices.get(deviceId);
    if (!id) return null;
    return this.roster.find((p) => p.id === id) ?? null;
  }

  markOnline(deviceId: string): void {
    this.online.add(deviceId);
    this.touch();
  }

  markOffline(deviceId: string): void {
    this.online.delete(deviceId);
    this.touch();
  }

  /** Participantes ayant reserve un prenom (= joueuses attendues). */
  claimedCount(): number {
    return this.claims.size;
  }

  // ----------------------------------------------------------- deroulement

  getPhase(): Phase {
    return this.phase;
  }

  start(): boolean {
    if (this.phase !== 'lobby') return false;
    if (this.roster.length < 2) return false;
    this.order = buildQuestionOrder(this.allQuestions, this.rng);
    this.questionIndex = -1;
    this.history = [];
    this.rotation.reset();
    return this.nextQuestion();
  }

  /** Passe a la question suivante (ou termine la partie). */
  nextQuestion(): boolean {
    if (this.phase === 'finished') return false;
    if (this.questionIndex + 1 >= this.order.length) {
      this.finish();
      return true;
    }
    this.questionIndex++;
    this.choices = this.rotation.pick(this.roster);
    this.votes = new Map();
    this.result = null;
    this.phase = 'voting';
    this.touch();
    return true;
  }

  closeVotes(): boolean {
    if (this.phase !== 'voting') return false;
    this.phase = 'locked';
    this.touch();
    return true;
  }

  reopenVotes(): boolean {
    if (this.phase !== 'locked') return false;
    this.phase = 'voting';
    this.touch();
    return true;
  }

  /** Lance le decompte 3-2-1. Le resultat n'est calcule qu'a la fin. */
  beginReveal(): boolean {
    if (this.phase !== 'voting' && this.phase !== 'locked') return false;
    this.phase = 'countdown';
    this.touch();
    return true;
  }

  /** Fin du decompte : on calcule et on affiche le resultat. */
  finishReveal(): boolean {
    if (this.phase !== 'countdown') return false;
    const question = this.currentQuestion();
    if (!question) return false;

    const tally = tallyVotes(this.choices, this.votes);
    const winners = winnersOf(tally);
    const podium = podiumOf(tally);
    const strength = strengthOf(tally);
    const { strengthLine, comment } = generateComment(
      { question, winners, podium, totalVotes: tally.totalVotes, strength },
      this.rng,
    );

    this.result = {
      questionId: question.id,
      questionText: question.text,
      totalVotes: tally.totalVotes,
      winners,
      podium,
      strength,
      strengthLine,
      comment,
    };

    const votesByParticipant = new Map<string, number>();
    for (const row of tally.rows) votesByParticipant.set(row.participantId, row.votes);
    this.history.push({
      questionId: question.id,
      winners: winners.map((w) => w.participantId),
      votesByParticipant,
      totalVotes: tally.totalVotes,
    });

    this.phase = 'result';
    this.touch();
    return true;
  }

  finish(): void {
    this.phase = 'finished';
    this.finalStats = this.computeFinalStats();
    this.touch();
  }

  /** Un telephone vote. Un seul vote par participante et par question. */
  vote(deviceId: string, choiceId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'voting') return { ok: false, error: 'Les votes sont fermés.' };
    const me = this.participantOf(deviceId);
    if (!me) return { ok: false, error: 'Choisis d’abord ton prénom.' };
    if (this.votes.has(me.id)) return { ok: false, error: 'Tu as déjà voté.' };
    if (choiceId === me.id) return { ok: false, error: 'On ne vote pas pour soi 😄' };
    if (!this.choices.some((c) => c.id === choiceId)) {
      return { ok: false, error: 'Ce choix n’est pas valide.' };
    }
    this.votes.set(me.id, choiceId);
    this.touch();
    return { ok: true };
  }

  currentQuestion(): Question | null {
    return this.order[this.questionIndex] ?? null;
  }

  private expectedVoters(): number {
    return Math.max(this.claims.size, this.votes.size);
  }

  private computeFinalStats(): FinalStats {
    const wins = new Map<string, number>();
    const received = new Map<string, number>();
    let totalVotes = 0;

    for (const round of this.history) {
      totalVotes += round.totalVotes;
      for (const id of round.winners) wins.set(id, (wins.get(id) ?? 0) + 1);
      for (const [id, n] of round.votesByParticipant) {
        received.set(id, (received.get(id) ?? 0) + n);
      }
    }

    const nameOf = (id: string): string =>
      this.roster.find((p) => p.id === id)?.name ?? '—';

    const top = (source: Map<string, number>): { id: string; value: number }[] => {
      let best = 0;
      for (const value of source.values()) if (value > best) best = value;
      if (best === 0) return [];
      return [...source.entries()]
        .filter(([, value]) => value === best)
        .map(([id, value]) => ({ id, value }))
        .sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), 'fr'))
        .slice(0, 3);
    };

    return {
      totalVotes,
      questionsPlayed: this.history.length,
      queens: top(wins).map((e) => ({ name: nameOf(e.id), wins: e.value })),
      mostCited: top(received).map((e) => ({ name: nameOf(e.id), votes: e.value })),
      closingLine: pickClosingLine(this.rng),
    };
  }

  // -------------------------------------------------------------- snapshots

  hostState(): HostState {
    const question = this.currentQuestion();
    return {
      code: this.code,
      joinUrl: this.joinUrl,
      qrDataUrl: this.qrDataUrl,
      phase: this.phase,
      roster: this.roster.map<RosterEntry>((p) => {
        const deviceId = this.claims.get(p.id);
        return {
          id: p.id,
          name: p.name,
          claimed: deviceId !== undefined,
          online: deviceId !== undefined && this.online.has(deviceId),
        };
      }),
      connectedCount: this.claims.size,
      questionIndex: this.questionIndex,
      totalQuestions: this.order.length || this.allQuestions.length,
      question: question
        ? { id: question.id, text: question.text, emoji: question.emoji }
        : null,
      choices: this.phase === 'lobby' ? [] : this.choices.map((c) => ({ ...c })),
      votesReceived: this.votes.size,
      expectedVoters: this.expectedVoters(),
      result: this.phase === 'result' ? this.result : null,
      finalStats: this.finalStats,
    };
  }

  playerState(deviceId: string): PlayerState {
    const me = this.participantOf(deviceId);
    const question = this.currentQuestion();
    const showQuestion = this.phase !== 'lobby' && this.phase !== 'finished';

    return {
      code: this.code,
      phase: this.phase,
      availableNames: this.roster
        .filter((p) => {
          const owner = this.claims.get(p.id);
          return owner === undefined || owner === deviceId;
        })
        .map((p) => ({ ...p })),
      me: me ? { ...me } : null,
      question:
        showQuestion && question
          ? { id: question.id, text: question.text, emoji: question.emoji }
          : null,
      choices: showQuestion ? this.choices.map((c) => ({ ...c })) : [],
      myVote: me ? (this.votes.get(me.id) ?? null) : null,
      votesReceived: this.votes.size,
      expectedVoters: this.expectedVoters(),
      result: this.phase === 'result' ? this.result : null,
      finalStats: this.finalStats,
    };
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
  }
}
