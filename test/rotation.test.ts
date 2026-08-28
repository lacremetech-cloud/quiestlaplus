import test from 'node:test';
import assert from 'node:assert/strict';
import { Rotation, CHOICES_PER_QUESTION } from '../src/shared/rotation.ts';
import type { Participant } from '../src/shared/types.ts';

function makePool(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `J${i + 1}` }));
}

/** Generateur deterministe (xorshift) pour des tests reproductibles. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

test('propose toujours exactement 6 prénoms', () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(7));
  for (let i = 0; i < 40; i++) {
    const group = rotation.pick(pool);
    assert.equal(group.length, CHOICES_PER_QUESTION);
    assert.equal(new Set(group.map((p) => p.id)).size, CHOICES_PER_QUESTION);
  }
});

test('équilibre les apparitions : écart max de 1 sur 30+ questions', () => {
  for (const size of [12, 15, 18, 20, 23]) {
    const pool = makePool(size);
    const rotation = new Rotation(seededRng(size * 13 + 1));
    for (let question = 1; question <= 40; question++) {
      rotation.pick(pool);
      const { min, max } = rotation.appearanceSpread(pool);
      assert.ok(
        max - min <= 1,
        `pool=${size} question=${question} écart=${max - min}`,
      );
    }
    const total = pool.reduce((sum, p) => sum + rotation.appearancesOf(p.id), 0);
    assert.equal(total, 40 * CHOICES_PER_QUESTION);
  }
});

test('évite au maximum les apparitions sur deux questions consécutives', () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(99));
  let previous: Set<string> = new Set();
  let repeats = 0;
  for (let i = 0; i < 40; i++) {
    const group = rotation.pick(pool);
    const ids = new Set(group.map((p) => p.id));
    for (const id of ids) if (previous.has(id)) repeats++;
    previous = ids;
  }
  // 18 participantes => 12 disponibles hors question precedente : 0 repetition.
  assert.equal(repeats, 0);
});

test('mélange les groupes : aucun groupe de 6 figé sur la durée', () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(2024));
  const signatures = new Set<string>();
  for (let i = 0; i < 30; i++) {
    signatures.add(
      rotation
        .pick(pool)
        .map((p) => p.id)
        .sort()
        .join(','),
    );
  }
  assert.ok(signatures.size >= 27, `groupes distincts: ${signatures.size}/30`);
});

test('fait se rencontrer des combinaisons variées', () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(5));
  const pairs = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const group = rotation.pick(pool);
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const key = [group[a]!.id, group[b]!.id].sort().join('|');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  const maxPossiblePairs = (18 * 17) / 2;
  // On veut une bonne couverture des binomes, pas 3 equipes figees.
  assert.ok(
    pairs.size > maxPossiblePairs * 0.6,
    `binômes différents: ${pairs.size}/${maxPossiblePairs}`,
  );
  const maxSeen = Math.max(...pairs.values());
  assert.ok(maxSeen <= 6, `binôme le plus répété: ${maxSeen} fois`);
});

test("l'ordre d'affichage est mélangé", () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(42));
  let identicalOrder = 0;
  for (let i = 0; i < 20; i++) {
    const group = rotation.pick(pool);
    const sorted = group.slice().sort((a, b) => a.id.localeCompare(b.id));
    if (group.every((p, idx) => p.id === sorted[idx]!.id)) identicalOrder++;
  }
  assert.ok(identicalOrder <= 2, `groupes non mélangés: ${identicalOrder}`);
});

test('supporte un petit groupe (moins de 6 participantes)', () => {
  const pool = makePool(4);
  const rotation = new Rotation(seededRng(3));
  for (let i = 0; i < 10; i++) {
    assert.equal(rotation.pick(pool).length, 4);
  }
});

test('reset remet les compteurs à zéro', () => {
  const pool = makePool(18);
  const rotation = new Rotation(seededRng(1));
  rotation.pick(pool);
  rotation.reset();
  assert.deepEqual(rotation.appearanceSpread(pool), { min: 0, max: 0 });
});
