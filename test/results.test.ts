import test from 'node:test';
import assert from 'node:assert/strict';
import {
  podiumOf,
  strengthOf,
  tallyVotes,
  winnersOf,
} from '../src/shared/results.ts';
import type { Participant } from '../src/shared/types.ts';

const CHOICES: Participant[] = [
  { id: 'a', name: 'Inès' },
  { id: 'b', name: 'Sarah' },
  { id: 'c', name: 'Nour' },
  { id: 'd', name: 'Maya' },
  { id: 'e', name: 'Lina' },
  { id: 'f', name: 'Jade' },
];

/** Construit une map de votes : `{a: 9}` = 9 votantes ont choisi `a`. */
function votes(counts: Record<string, number>): Map<string, string> {
  const map = new Map<string, string>();
  let voter = 0;
  for (const [choice, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) map.set(`voter${voter++}`, choice);
  }
  return map;
}

test('compte les votes et calcule les pourcentages', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 9, b: 5, c: 3 }));
  assert.equal(tally.totalVotes, 17);
  const first = tally.rows[0]!;
  assert.equal(first.name, 'Inès');
  assert.equal(first.votes, 9);
  assert.equal(first.percent, 53);
});

test('les choix sans aucun vote ne montent pas sur le podium', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 4, b: 2 }));
  const podium = podiumOf(tally);
  assert.equal(podium.length, 2);
  assert.ok(tally.rows.some((r) => r.votes === 0));
});

test('victoire écrasante', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 14, b: 3, c: 1 }));
  assert.equal(strengthOf(tally), 'landslide');
  assert.equal(winnersOf(tally).length, 1);
});

test('victoire serrée', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 6, b: 5, c: 4, d: 3 }));
  assert.equal(strengthOf(tally), 'close');
});

test('égalité en tête', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 6, b: 6, c: 3 }));
  assert.equal(strengthOf(tally), 'tie');
  const winners = winnersOf(tally);
  assert.equal(winners.length, 2);
  assert.deepEqual(
    winners.map((w) => w.name).sort(),
    ['Inès', 'Sarah'],
  );
  // Les ex aequo partagent le rang 1, la suivante est rang 2.
  assert.equal(podiumOf(tally).find((r) => r.name === 'Nour')?.rank, 2);
});

test('égalité à trois', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 4, b: 4, c: 4, d: 2 }));
  assert.equal(winnersOf(tally).length, 3);
  assert.equal(strengthOf(tally), 'tie');
});

test('votes très dispersés', () => {
  const tally = tallyVotes(CHOICES, votes({ a: 5, b: 3, c: 3, d: 3, e: 3, f: 3 }));
  assert.equal(strengthOf(tally), 'scattered');
});

test('aucun vote', () => {
  const tally = tallyVotes(CHOICES, new Map());
  assert.equal(tally.totalVotes, 0);
  assert.deepEqual(winnersOf(tally), []);
  assert.deepEqual(podiumOf(tally), []);
  assert.equal(strengthOf(tally), 'scattered');
});

test('ignore les votes portant sur des choix obsolètes', () => {
  const map = votes({ a: 3 });
  map.set('vieux', 'inconnu');
  const tally = tallyVotes(CHOICES, map);
  assert.equal(tally.totalVotes, 3);
});

test('un seul vote exprimé reste cohérent', () => {
  const tally = tallyVotes(CHOICES, votes({ c: 1 }));
  assert.equal(tally.totalVotes, 1);
  assert.equal(winnersOf(tally)[0]!.percent, 100);
  assert.equal(strengthOf(tally), 'landslide');
});
