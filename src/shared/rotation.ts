import type { Participant } from './types.ts';

export type Rng = () => number;

export const CHOICES_PER_QUESTION = 6;

interface Stats {
  /** Nombre d'apparitions par participante. */
  appearances: Map<string, number>;
  /** Ids proposes a la question precedente. */
  previous: Set<string>;
  /** Nombre de fois ou deux participantes sont apparues ensemble. */
  together: Map<string, number>;
  /** Signatures des groupes deja proposes (pour eviter les repetitions exactes). */
  seenGroups: Set<string>;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Roulement equitable des prenoms proposes.
 *
 * Garanties :
 *  - on ne pioche jamais dans le palier `n+1` tant que le palier `n` n'est pas
 *    epuise => l'ecart d'apparitions entre deux participantes reste <= 1 ;
 *  - a l'interieur d'un palier on evite les participantes de la question
 *    precedente, puis les binomes deja trop vus ;
 *  - l'ordre d'affichage est melange a chaque question ;
 *  - les groupes se recomposent a chaque cycle (aucune equipe figee).
 */
export class Rotation {
  private readonly stats: Stats = {
    appearances: new Map(),
    previous: new Set(),
    together: new Map(),
    seenGroups: new Set(),
  };

  private readonly rng: Rng;

  constructor(rng: Rng = Math.random) {
    this.rng = rng;
  }

  /** Remet a zero l'historique (changement de roster, nouvelle partie). */
  reset(): void {
    this.stats.appearances.clear();
    this.stats.previous.clear();
    this.stats.together.clear();
    this.stats.seenGroups.clear();
  }

  appearancesOf(id: string): number {
    return this.stats.appearances.get(id) ?? 0;
  }

  /** Repartition des apparitions, utile pour les tests et le debug. */
  appearanceSpread(pool: Participant[]): { min: number; max: number } {
    if (pool.length === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const p of pool) {
      const n = this.appearancesOf(p.id);
      if (n < min) min = n;
      if (n > max) max = n;
    }
    return { min, max };
  }

  /** Choisit les 6 prenoms de la prochaine question. */
  pick(pool: Participant[], size = CHOICES_PER_QUESTION): Participant[] {
    const target = Math.min(size, pool.length);
    if (target === 0) return [];

    const best = this.bestCandidate(pool, target);
    this.commit(best);
    return shuffle(best, this.rng);
  }

  /**
   * Genere quelques groupes valides et retient celui qui repete le moins de
   * binomes. Le tirage etant deja contraint par les paliers, quelques essais
   * suffisent pour bien varier les combinaisons.
   */
  private bestCandidate(pool: Participant[], target: number): Participant[] {
    const ATTEMPTS = 8;
    let best: Participant[] | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < ATTEMPTS; i++) {
      const group = this.buildGroup(pool, target);
      let score = this.pairCost(group);
      if (this.stats.seenGroups.has(signature(group))) score += 1000;
      if (score < bestScore) {
        bestScore = score;
        best = group;
      }
      if (bestScore === 0) break;
    }
    return best ?? this.buildGroup(pool, target);
  }

  /** Tirage greedy palier par palier. */
  private buildGroup(pool: Participant[], target: number): Participant[] {
    const chosen: Participant[] = [];
    // Paliers d'apparitions croissants : on vide le palier courant avant
    // d'entamer le suivant, ce qui borne l'ecart a 1.
    const tiers = new Map<number, Participant[]>();
    for (const p of pool) {
      const n = this.appearancesOf(p.id);
      const tier = tiers.get(n);
      if (tier) tier.push(p);
      else tiers.set(n, [p]);
    }
    const levels = [...tiers.keys()].sort((a, b) => a - b);

    for (const level of levels) {
      if (chosen.length >= target) break;
      const remaining = shuffle(tiers.get(level) as Participant[], this.rng);
      const needed = target - chosen.length;

      if (remaining.length <= needed) {
        chosen.push(...remaining);
        continue;
      }

      // Palier plus grand que le besoin : on classe les candidates.
      const scored = remaining.map((p) => ({
        p,
        previous: this.stats.previous.has(p.id) ? 1 : 0,
        jitter: this.rng(),
      }));

      while (chosen.length < target && scored.length > 0) {
        let bestIdx = 0;
        let bestKey = Infinity;
        for (let i = 0; i < scored.length; i++) {
          const c = scored[i] as (typeof scored)[number];
          const key =
            c.previous * 100 + this.pairCostWith(chosen, c.p) * 5 + c.jitter;
          if (key < bestKey) {
            bestKey = key;
            bestIdx = i;
          }
        }
        chosen.push((scored[bestIdx] as (typeof scored)[number]).p);
        scored.splice(bestIdx, 1);
      }
    }

    return chosen;
  }

  private pairCostWith(chosen: Participant[], candidate: Participant): number {
    let cost = 0;
    for (const c of chosen) {
      cost += this.stats.together.get(pairKey(c.id, candidate.id)) ?? 0;
    }
    return cost;
  }

  private pairCost(group: Participant[]): number {
    let cost = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i] as Participant;
        const b = group[j] as Participant;
        const seen = this.stats.together.get(pairKey(a.id, b.id)) ?? 0;
        cost += seen * seen;
      }
    }
    return cost;
  }

  private commit(group: Participant[]): void {
    for (const p of group) {
      this.stats.appearances.set(p.id, this.appearancesOf(p.id) + 1);
    }
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i] as Participant;
        const b = group[j] as Participant;
        const key = pairKey(a.id, b.id);
        this.stats.together.set(key, (this.stats.together.get(key) ?? 0) + 1);
      }
    }
    this.stats.seenGroups.add(signature(group));
    this.stats.previous.clear();
    for (const p of group) this.stats.previous.add(p.id);
  }
}

function signature(group: Participant[]): string {
  return group
    .map((p) => p.id)
    .sort()
    .join(',');
}
