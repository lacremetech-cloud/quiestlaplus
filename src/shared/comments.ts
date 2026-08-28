import type { PodiumRow, Question, ResultStrength } from './types.ts';
import type { Rng } from './rotation.ts';

/** Phrases d'ambiance liees a la forme du resultat. */
const STRENGTH_LINES: Record<ResultStrength, string[]> = {
  landslide: [
    "Bon… là ce n'est même plus un vote, c'est un consensus.",
    'Le groupe est unanime. Aucun recours possible.',
    "Ce n'était même pas un débat, en fait.",
  ],
  close: [
    "Ça s'est joué à RIEN. 👀",
    'Un vote de plus et on changeait de gagnante.',
    'Photo finish. Le groupe a tremblé.',
  ],
  tie: [
    'Le groupe refuse visiblement de trancher.',
    'Égalité parfaite. Personne ne veut choisir.',
    'Deux dossiers, aucune décision.',
  ],
  scattered: [
    "Absolument personne n'est d'accord dans cette maison. 😭",
    'Les votes sont partis dans tous les sens.',
    "Aucune majorité. Le débat reste ouvert (mais interdit).",
  ],
  normal: ['', 'Le verdict est tombé.', 'Le groupe a tranché.'],
};

/** Repli si une question n'a aucun template specifique. */
const FALLBACK_TEMPLATES = [
  '{winner}, le groupe est formel : {pct} %.',
  '{votes} personnes ont désigné {winner}. Dossier classé.',
  '{winner}, tu ne pourras pas dire que tu ne savais pas.',
];

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Formate une liste de prenoms en francais : "Inès, Sarah et Nour". */
export function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] as string;
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1] as string}`;
}

export interface CommentInput {
  question: Question;
  winners: PodiumRow[];
  podium: PodiumRow[];
  totalVotes: number;
  strength: ResultStrength;
}

export interface GeneratedComment {
  strengthLine: string;
  comment: string;
}

/**
 * Genere localement (sans aucune API) le commentaire affiche sous le podium :
 * une phrase liee a la forme du resultat + une punchline propre a la question.
 */
export function generateComment(
  input: CommentInput,
  rng: Rng = Math.random,
): GeneratedComment {
  const { question, winners, podium, totalVotes, strength } = input;

  if (totalVotes === 0 || winners.length === 0) {
    return {
      strengthLine: 'Aucun vote enregistré.',
      comment: 'Le groupe a préféré garder le silence. On passe à la suivante.',
    };
  }

  const winnerNames = joinNames(winners.map((w) => w.name));
  const first = winners[0] as PodiumRow;
  const runnerUp = podium.find((r) => r.rank === 2);

  const values: Record<string, string> = {
    winner: winnerNames,
    votes: String(first.votes),
    pct: String(first.percent),
    second: runnerUp?.name ?? '—',
    gap: String(first.votes - (runnerUp?.votes ?? 0)),
    voters: String(totalVotes),
  };

  const templates =
    question.templates.length > 0 ? question.templates : FALLBACK_TEMPLATES;

  return {
    strengthLine: pick(STRENGTH_LINES[strength], rng),
    comment: render(pick(templates, rng), values),
  };
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? (values[key] as string) : match,
  );
}

/** Phrases de cloture de l'ecran final. */
const CLOSING_LINES = [
  'Beaucoup de votes. Beaucoup de dossiers. Aucun débat autorisé.',
  'Tout a été dit. Rien ne sortira de cette pièce.',
  "Le groupe a parlé. On ne revient pas là-dessus.",
];

export function pickClosingLine(rng: Rng = Math.random): string {
  return pick(CLOSING_LINES, rng);
}
