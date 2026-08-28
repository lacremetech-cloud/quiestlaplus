import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/shared/questions.ts';
import { generateComment, joinNames } from '../src/shared/comments.ts';
import { podiumOf, strengthOf, tallyVotes, winnersOf } from '../src/shared/results.ts';
import type { Participant, Question, ResultStrength } from '../src/shared/types.ts';

const CHOICES: Participant[] = [
  { id: 'a', name: 'Inès' },
  { id: 'b', name: 'Sarah' },
  { id: 'c', name: 'Nour' },
  { id: 'd', name: 'Maya' },
  { id: 'e', name: 'Lina' },
  { id: 'f', name: 'Jade' },
];

function votes(counts: Record<string, number>): Map<string, string> {
  const map = new Map<string, string>();
  let voter = 0;
  for (const [choice, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) map.set(`voter${voter++}`, choice);
  }
  return map;
}

function commentFor(question: Question, counts: Record<string, number>, pick = 0) {
  const tally = tallyVotes(CHOICES, votes(counts));
  return {
    strength: strengthOf(tally),
    ...generateComment(
      {
        question,
        winners: winnersOf(tally),
        podium: podiumOf(tally),
        totalVotes: tally.totalVotes,
        strength: strengthOf(tally),
      },
      () => pick,
    ),
  };
}

test('toutes les questions ont un id, un texte, une catégorie et des templates', () => {
  const ids = new Set<string>();
  for (const question of QUESTIONS) {
    assert.ok(question.id.length > 0);
    assert.ok(question.text.length > 0);
    assert.ok(question.category.length > 0);
    assert.ok(question.emoji.length > 0);
    assert.ok(question.templates.length >= 2, `${question.id} manque de templates`);
    assert.ok(!ids.has(question.id), `id dupliqué: ${question.id}`);
    ids.add(question.id);
  }
  assert.equal(QUESTIONS.length, 32);
});

test('aucun placeholder ne reste dans les commentaires générés', () => {
  const scenarios: Record<string, number>[] = [
    { a: 14, b: 3, c: 1 },
    { a: 6, b: 5, c: 4 },
    { a: 5, b: 5, c: 3 },
    { a: 5, b: 3, c: 3, d: 3, e: 3, f: 3 },
    { a: 1 },
  ];
  for (const question of QUESTIONS) {
    for (const scenario of scenarios) {
      for (let pick = 0; pick < 0.99; pick += 0.24) {
        const { comment, strengthLine } = commentFor(question, scenario, pick);
        assert.ok(!/\{\w+\}/.test(comment), `${question.id}: ${comment}`);
        assert.ok(!/\{\w+\}/.test(strengthLine));
        assert.ok(comment.length > 0);
      }
    }
  }
});

test('la phrase d’ambiance suit la forme du résultat', () => {
  const question = QUESTIONS[0]!;
  const cases: [Record<string, number>, ResultStrength, string][] = [
    [{ a: 14, b: 3, c: 1 }, 'landslide', 'consensus'],
    [{ a: 6, b: 5, c: 4 }, 'close', 'RIEN'],
    [{ a: 5, b: 5, c: 3 }, 'tie', 'trancher'],
    [{ a: 5, b: 3, c: 3, d: 3, e: 3, f: 3 }, 'scattered', 'accord'],
  ];
  for (const [counts, expected, needle] of cases) {
    const result = commentFor(question, counts);
    assert.equal(result.strength, expected);
    assert.ok(result.strengthLine.includes(needle), result.strengthLine);
  }
});

test('les ex aequo sont nommées ensemble', () => {
  const result = commentFor(QUESTIONS[2]!, { a: 6, b: 6, c: 2 });
  assert.ok(result.comment.includes('Inès et Sarah'), result.comment);
});

test('sans vote, le commentaire reste bienveillant', () => {
  const result = commentFor(QUESTIONS[5]!, {});
  assert.match(result.strengthLine, /Aucun vote/);
  assert.ok(result.comment.length > 0);
});

test('joinNames formate correctement les listes', () => {
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Inès']), 'Inès');
  assert.equal(joinNames(['Inès', 'Sarah']), 'Inès et Sarah');
  assert.equal(joinNames(['Inès', 'Sarah', 'Nour']), 'Inès, Sarah et Nour');
});

test('aucun commentaire ne dépasse une ligne lisible au vidéoprojecteur', () => {
  for (const question of QUESTIONS) {
    for (const template of question.templates) {
      assert.ok(template.length <= 110, `${question.id}: ${template.length} caractères`);
    }
  }
});
