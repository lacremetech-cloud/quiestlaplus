import type { Participant, PodiumRow, ResultStrength } from './types.ts';

export interface Tally {
  rows: PodiumRow[];
  totalVotes: number;
}

/**
 * Compte les votes. `votes` associe l'id d'une votante a l'id de son choix.
 * Les choix sans aucun vote sont conserves dans `rows` (avec 0) mais ne
 * remontent jamais sur le podium.
 */
export function tallyVotes(
  choices: Participant[],
  votes: Map<string, string>,
): Tally {
  const counts = new Map<string, number>();
  for (const c of choices) counts.set(c.id, 0);

  let totalVotes = 0;
  for (const choiceId of votes.values()) {
    if (!counts.has(choiceId)) continue; // vote obsolete (question changee)
    counts.set(choiceId, (counts.get(choiceId) as number) + 1);
    totalVotes++;
  }

  const sorted = choices
    .map((c) => ({ participant: c, votes: counts.get(c.id) as number }))
    .sort((a, b) => b.votes - a.votes || a.participant.name.localeCompare(b.participant.name, 'fr'));

  const distinct = [...new Set(sorted.map((r) => r.votes))].sort((a, b) => b - a);

  const rows: PodiumRow[] = sorted.map((r) => ({
    participantId: r.participant.id,
    name: r.participant.name,
    votes: r.votes,
    percent: totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0,
    rank: distinct.indexOf(r.votes) + 1,
  }));

  return { rows, totalVotes };
}

/** Les premieres ex aequo (vide si personne n'a vote). */
export function winnersOf(tally: Tally): PodiumRow[] {
  if (tally.totalVotes === 0) return [];
  return tally.rows.filter((r) => r.rank === 1 && r.votes > 0);
}

/** Les 3 premiers rangs, ex aequo inclus, sans les scores nuls. */
export function podiumOf(tally: Tally): PodiumRow[] {
  return tally.rows.filter((r) => r.votes > 0 && r.rank <= 3);
}

/** Qualifie la "forme" du resultat, ce qui pilote le commentaire affiche. */
export function strengthOf(tally: Tally): ResultStrength {
  const winners = winnersOf(tally);
  if (tally.totalVotes === 0) return 'scattered';
  if (winners.length > 1) return 'tie';

  const first = winners[0] as PodiumRow;
  const runnerUp = tally.rows.find((r) => r.rank === 2);
  const gapVotes = first.votes - (runnerUp?.votes ?? 0);
  const gapPercent = first.percent - (runnerUp?.percent ?? 0);

  if (first.percent >= 50 || gapPercent >= 30) return 'landslide';
  if (gapVotes <= 1 || gapPercent <= 8) return 'close';
  if (first.percent < 30) return 'scattered';
  return 'normal';
}
