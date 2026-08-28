import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, buildQuestionOrder, sanitizeNames } from '../src/server/game.ts';
import { QUESTIONS } from '../src/shared/questions.ts';

function makeRoom(): Room {
  return new Room({ code: 'TEST', joinUrl: 'http://x/j/TEST', qrDataUrl: '' });
}

/** Fait rejoindre n telephones et reserver un prenom a chacun. */
function fillRoom(room: Room, n: number): string[] {
  const roster = room.getRoster();
  const devices: string[] = [];
  for (let i = 0; i < n; i++) {
    const device = `device-${i}`;
    room.markOnline(device);
    assert.equal(room.claim(device, roster[i]!.id).ok, true);
    devices.push(device);
  }
  return devices;
}

test('la partie démarre avec les 18 prénoms de démonstration', () => {
  const room = makeRoom();
  assert.equal(room.getRoster().length, 18);
  assert.equal(room.getPhase(), 'lobby');
});

test('l’hôte peut modifier, supprimer et ajouter des prénoms', () => {
  const room = makeRoom();
  room.setRoster(['Inès', 'Lina', 'Camille', 'camille', '   ', 'Zoé']);
  assert.deepEqual(
    room.getRoster().map((p) => p.name),
    ['Inès', 'Lina', 'Camille', 'Zoé'],
  );
});

test('nettoyage des prénoms : doublons, espaces, longueur', () => {
  assert.deepEqual(sanitizeNames(['  Léa  ', 'léa', '', 42, 'a'.repeat(60)]), [
    'Léa',
    'a'.repeat(24),
  ]);
  assert.deepEqual(sanitizeNames('pas un tableau'), []);
});

test('un prénom déjà réservé ne peut pas être pris par un autre téléphone', () => {
  const room = makeRoom();
  const target = room.getRoster()[0]!.id;
  assert.equal(room.claim('device-a', target).ok, true);
  const second = room.claim('device-b', target);
  assert.equal(second.ok, false);
});

test('un refresh du téléphone conserve le prénom et le vote', () => {
  const room = makeRoom();
  fillRoom(room, 6);
  room.start();
  const choices = room.hostState().choices;
  const me = room.participantOf('device-0')!;
  const target = choices.find((c) => c.id !== me.id)!;
  assert.equal(room.vote('device-0', target.id).ok, true);

  // Refresh : meme deviceId, nouvelle connexion.
  room.markOffline('device-0');
  room.markOnline('device-0');
  const state = room.playerState('device-0');
  assert.equal(state.me?.id, me.id);
  assert.equal(state.myVote, target.id);

  // Et impossible de revoter.
  const second = room.vote('device-0', choices.find((c) => c.id !== me.id && c.id !== target.id)!.id);
  assert.equal(second.ok, false);
  assert.equal(room.hostState().votesReceived, 1);
});

test('on ne peut pas voter pour soi-même', () => {
  const room = makeRoom();
  fillRoom(room, 18);
  room.start();
  let checked = false;
  for (let question = 0; question < 6 && !checked; question++) {
    const choices = room.hostState().choices;
    for (let i = 0; i < 18; i++) {
      const me = room.participantOf(`device-${i}`)!;
      if (choices.some((c) => c.id === me.id)) {
        const result = room.vote(`device-${i}`, me.id);
        assert.equal(result.ok, false);
        assert.match((result as { error: string }).error, /soi/);
        checked = true;
        break;
      }
    }
    room.revealResult();
    room.nextQuestion();
  }
  assert.ok(checked, 'aucune participante ne s’est vue proposer son propre prénom');
});

test('les votes sont refusés hors de la phase de vote', () => {
  const room = makeRoom();
  fillRoom(room, 6);
  assert.equal(room.vote('device-0', 'p2').ok, false); // lobby
  room.start();
  room.closeVotes();
  const choices = room.hostState().choices;
  const me = room.participantOf('device-1')!;
  assert.equal(room.vote('device-1', choices.find((c) => c.id !== me.id)!.id).ok, false);
  room.reopenVotes();
  assert.equal(room.vote('device-1', choices.find((c) => c.id !== me.id)!.id).ok, true);
});

test('les résultats restent cachés jusqu’à la révélation', () => {
  const room = makeRoom();
  fillRoom(room, 8);
  room.start();
  const choices = room.hostState().choices;
  for (let i = 0; i < 8; i++) {
    const me = room.participantOf(`device-${i}`)!;
    room.vote(`device-${i}`, choices.find((c) => c.id !== me.id)!.id);
  }
  // Tout le monde a vote : le jeu ne revele PAS tout seul.
  assert.equal(room.getPhase(), 'voting');
  assert.equal(room.hostState().result, null);
  assert.equal(room.playerState('device-0').result, null);

  // La revelation est immediate : plus de decompte entre deux questions.
  room.revealResult();
  assert.equal(room.getPhase(), 'result');
  assert.ok(room.hostState().result);
});

test('une participante qui rejoint en retard peut voter', () => {
  const room = makeRoom();
  fillRoom(room, 4);
  room.start();
  const roster = room.getRoster();
  const late = roster.find((p) => !room.hostState().roster.find((r) => r.id === p.id)?.claimed)!;
  assert.equal(room.claim('device-late', late.id).ok, true);
  const choices = room.hostState().choices;
  const target = choices.find((c) => c.id !== late.id)!;
  assert.equal(room.vote('device-late', target.id).ok, true);
});

test('une partie complète produit des statistiques finales cohérentes', () => {
  const room = makeRoom();
  fillRoom(room, 18);
  room.start();
  let totalCast = 0;

  for (let question = 0; question < QUESTIONS.length; question++) {
    const choices = room.hostState().choices;
    assert.equal(choices.length, 6);
    for (let i = 0; i < 18; i++) {
      const me = room.participantOf(`device-${i}`)!;
      const target = choices.find((c) => c.id !== me.id)!;
      if (room.vote(`device-${i}`, target.id).ok) totalCast++;
    }
    room.revealResult();
    const result = room.hostState().result!;
    assert.ok(result.winners.length >= 1);
    assert.ok(result.comment.length > 0);
    room.nextQuestion();
  }

  // Apres la derniere question : le 3-2-1 du grand final, puis les stats.
  assert.equal(room.getPhase(), 'countdown');
  assert.equal(room.hostState().finalStats, null);
  room.completeFinale();

  assert.equal(room.getPhase(), 'finished');
  const stats = room.hostState().finalStats!;
  assert.equal(stats.questionsPlayed, QUESTIONS.length);
  assert.equal(stats.totalVotes, totalCast);
  assert.ok(stats.queens.length >= 1);
  assert.ok(stats.mostCited.length >= 1);
  assert.ok(stats.closingLine.length > 0);
});

test('le décompte 3-2-1 est réservé à la fin de partie', () => {
  const room = makeRoom();
  fillRoom(room, 6);
  room.start();

  // Sur une question normale, RÉVÉLER affiche le résultat immédiatement.
  const choices = room.hostState().choices;
  for (let i = 0; i < 6; i++) {
    const me = room.participantOf(`device-${i}`)!;
    room.vote(`device-${i}`, choices.find((c) => c.id !== me.id)!.id);
  }
  assert.equal(room.revealResult(), true);
  assert.equal(room.getPhase(), 'result');
  assert.ok(room.hostState().result);

  // Seule la fin de partie passe par le décompte.
  assert.equal(room.beginFinale(), true);
  assert.equal(room.getPhase(), 'countdown');
  assert.equal(room.hostState().finalStats, null);
  assert.equal(room.completeFinale(), true);
  assert.equal(room.getPhase(), 'finished');
  assert.ok(room.hostState().finalStats);
});

test('les styles de questions sont mélangés', () => {
  const order = buildQuestionOrder(QUESTIONS, () => 0.5);
  assert.equal(order.length, QUESTIONS.length);
  assert.equal(new Set(order.map((q) => q.id)).size, QUESTIONS.length);
  let longestRun = 1;
  let run = 1;
  for (let i = 1; i < order.length; i++) {
    run = order[i]!.category === order[i - 1]!.category ? run + 1 : 1;
    if (run > longestRun) longestRun = run;
  }
  assert.ok(longestRun <= 3, `série de ${longestRun} questions de même style`);
});

test('l’état de l’hôte ne révèle jamais qui a voté pour qui', () => {
  const room = makeRoom();
  fillRoom(room, 6);
  room.start();
  const snapshot = JSON.stringify(room.hostState());
  assert.ok(!snapshot.includes('device-'));
  room.revealResult();
  assert.ok(!JSON.stringify(room.hostState()).includes('device-'));
});
