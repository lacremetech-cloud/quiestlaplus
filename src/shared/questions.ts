import type { Question } from './types.ts';

/**
 * Les questions du jeu.
 * Pour en ajouter/modifier : editez simplement ce tableau.
 * Placeholders disponibles dans les templates :
 *   {winner} {votes} {pct} {second} {gap} {voters}
 */
export const QUESTIONS: Question[] = [
  {
    id: 'q01',
    text: 'Qui arrive toujours en retard ?',
    category: 'perso',
    emoji: '⏰',
    templates: [
      '{winner}, même le groupe savait que ce résultat allait arriver avant toi.',
      "{winner} n'est pas en retard. C'est l'heure qui est en avance. ⏰",
      "On a compté : {votes} personnes t'attendent encore, {winner}.",
    ],
  },
  {
    id: 'q02',
    text: 'Qui pourrait devenir célèbre ?',
    category: 'projection',
    emoji: '⭐',
    templates: [
      "{winner}, pense à nous quand tu ne répondras plus aux messages. ⭐",
      'Le groupe a déjà réservé les places au premier rang, {winner}.',
      "{winner} : {pct} % de la salle demande déjà un autographe.",
    ],
  },
  {
    id: 'q03',
    text: 'Qui pourrait devenir millionnaire ?',
    category: 'projection',
    emoji: '💸',
    templates: [
      '{winner}, le groupe attend visiblement les invitations sur le yacht. 💸',
      "Bon… on sait déjà qui va payer les vacances dans 10 ans.",
      '{winner}, commence à préparer les virements aux copines.',
    ],
  },
  {
    id: 'q04',
    text: 'Qui pourrait devenir Présidente de la République ?',
    category: 'projection',
    emoji: '🇫🇷',
    templates: [
      '{winner} élue avec {pct} % au premier tour. Aucun recours possible.',
      'Le programme de {winner} : personne ne le connaît, tout le monde vote quand même.',
      "{winner}, le discours d'investiture c'est maintenant.",
    ],
  },
  {
    id: 'q05',
    text: 'Qui rigole toujours au pire moment ?',
    category: 'humour',
    emoji: '😭',
    templates: [
      "{winner}, le silence n'a jamais eu aucune chance avec toi.",
      "Minute de silence + {winner} = mauvaise combinaison, d'après {votes} témoins.",
      "{winner} a un timing… disons unique. 😭",
    ],
  },
  {
    id: 'q06',
    text: 'Qui peut te laisser en vu pendant 3 jours et revenir comme si de rien n’était ?',
    category: 'perso',
    emoji: '📱',
    templates: [
      '{winner}… {votes} personnes aimeraient apparemment une réponse. 📱',
      'Le service client {winner} est actuellement indisponible.',
      '{winner} répond. Juste pas cette semaine.',
    ],
  },
  {
    id: 'q07',
    text: 'Qui est toujours au courant de TOUT ?',
    category: 'perso',
    emoji: '👀',
    templates: [
      "{winner} n'apprend pas les nouvelles. Les nouvelles passent d'abord par {winner}. 👀",
      "{pct} % du groupe confirme : l'information circule, mais {winner} l'avait déjà.",
      "{winner}, tu peux fermer l'agence de presse, tout le monde sait.",
    ],
  },
  {
    id: 'q08',
    text: 'Qui est la plus drôle ?',
    category: 'perso',
    emoji: '😂',
    templates: [
      "{winner} n'a même pas eu besoin de faire une blague pour gagner.",
      '{votes} personnes confirment : {winner} fait rire, même sans essayer.',
      'Le titre revient à {winner}, avec {pct} % des voix. 😂',
    ],
  },
  {
    id: 'q09',
    text: 'À qui tu confierais ton plus gros secret ?',
    category: 'perso',
    emoji: '🤐',
    templates: [
      '{winner}, coffre-fort officiel du groupe. 🤐',
      '{votes} secrets viennent de trouver leur nouvelle adresse : {winner}.',
      "{winner} sait tout et ne dira rien. C'est ça la vraie force.",
    ],
  },
  {
    id: 'q10',
    text: 'Qui est incapable de mentir sans se faire griller ?',
    category: 'humour',
    emoji: '🙈',
    templates: [
      "{winner}, ton visage parle avant toi. À chaque fois.",
      "Mentir avec {winner} : projet abandonné par {pct} % du groupe.",
      "{winner} pourrait tout avouer avant même qu'on pose la question. 🙈",
    ],
  },
  {
    id: 'q11',
    text: 'Qui a le plus de flow ?',
    category: 'perso',
    emoji: '✨',
    templates: [
      "Le peuple a parlé. {winner} n'a même pas eu besoin de défendre son dossier. ✨",
      '{winner}, {pct} % du groupe valide sans discuter.',
      'Le flow de {winner} : sujet clos.',
    ],
  },
  {
    id: 'q12',
    text: 'Qui est la plus susceptible d’envoyer un vocal de 10 minutes ?',
    category: 'humour',
    emoji: '🎙️',
    templates: [
      "{winner}, {votes} personnes écoutent encore le vocal d'hier. 🎙️",
      'Vocal de {winner} : prévoyez des écouteurs et du temps libre.',
      "{winner} pourrait écrire un message. {winner} ne le fera pas.",
    ],
  },
  {
    id: 'q13',
    text: 'Qui peut dire « j’arrive » alors qu’elle n’est même pas encore prête ?',
    category: 'humour',
    emoji: '🚿',
    templates: [
      '« J\'arrive » de {winner} = entre 20 minutes et jamais.',
      "{pct} % du groupe a déjà attendu ce fameux « j'arrive ».",
      "{winner}, on sait que tu es encore sous la douche. 🚿",
    ],
  },
  {
    id: 'q14',
    text: 'Qui ferait rire tout le monde sans même le vouloir ?',
    category: 'humour',
    emoji: '🤭',
    templates: [
      '{winner} fait rire sans effort. Le vrai talent. 🤭',
      "{winner} ne cherche rien. {votes} personnes rient quand même.",
      "Talent naturel confirmé à {pct} % pour {winner}.",
    ],
  },
  {
    id: 'q15',
    text: 'Qui donnerait les meilleurs conseils sans jamais les appliquer elle-même ?',
    category: 'humour',
    emoji: '🧠',
    templates: [
      '{winner} : excellente conseillère, cliente catastrophique.',
      "{winner}, tes conseils sont parfaits. Applique-les, un jour, peut-être.",
      '{votes} personnes ont déjà suivi un conseil de {winner}. {winner}, non. 🧠',
    ],
  },
  {
    id: 'q16',
    text: 'Qui prendrait immédiatement la défense d’une copine ?',
    category: 'perso',
    emoji: '🛡️',
    templates: [
      '{winner} arrive avant même de connaître le contexte. 🛡️',
      '{votes} personnes savent qui appeler en cas de problème : {winner}.',
      "{winner}, garde du corps officielle du groupe à {pct} %.",
    ],
  },
  {
    id: 'q17',
    text: 'Qui réussirait le mieux à convaincre tout le monde ?',
    category: 'perso',
    emoji: '🎤',
    templates: [
      '{winner} a convaincu {votes} personnes sans même plaider. 🎤',
      "Argumenter contre {winner} : {pct} % du groupe déconseille.",
      "{winner}, tu pourrais vendre n'importe quoi à ce groupe.",
    ],
  },
  {
    id: 'q18',
    text: 'Qui pourrait devenir la maman du groupe ?',
    category: 'perso',
    emoji: '💗',
    templates: [
      '{winner}, chargée officielle des chargeurs, des pansements et des rappels. 💗',
      '{votes} personnes se reposent déjà entièrement sur {winner}.',
      "{winner} a toujours un mouchoir, une réponse et un plan B.",
    ],
  },
  {
    id: 'q19',
    text: 'Qui pourrait réussir tout ce qu’elle entreprend ?',
    category: 'projection',
    emoji: '🚀',
    templates: [
      '{winner}, {pct} % du groupe parie sur toi les yeux fermés. 🚀',
      "Le groupe n'a même pas hésité : {winner}.",
      '{winner}, la pression est officiellement lancée.',
    ],
  },
  {
    id: 'q20',
    text: 'Qui pourrait avoir la vie la plus improbable dans 10 ans ?',
    category: 'projection',
    emoji: '🔮',
    templates: [
      "{winner}, personne ne sait ce que tu feras. Tout le monde a hâte de voir. 🔮",
      '{votes} personnes attendent déjà le documentaire sur {winner}.',
      "Dans 10 ans, {winner} aura une histoire que personne n'aura vue venir.",
    ],
  },
  {
    id: 'q21',
    text: 'Tu pars pour 8 heures de route : qui tu prends avec toi ?',
    category: 'scenario',
    emoji: '🚗',
    templates: [
      '8 heures avec {winner} et visiblement personne ne demande à descendre. 🚗',
      '{winner} gère la playlist. Ce n\'est pas négociable.',
      '{votes} personnes signeraient pour ce road trip avec {winner}.',
    ],
  },
  {
    id: 'q22',
    text: 'T’es perdue dans une ville inconnue sans téléphone : qui tu veux avec toi ?',
    category: 'scenario',
    emoji: '🗺️',
    templates: [
      '{winner}, boussole humaine officielle du groupe. 🗺️',
      'Être perdue avec {winner} : {pct} % du groupe trouve ça rassurant.',
      "{winner} ne connaît pas le chemin non plus, mais ça va bien se passer.",
    ],
  },
  {
    id: 'q23',
    text: 'T’as besoin d’une excuse crédible en urgence : qui tu appelles ?',
    category: 'scenario',
    emoji: '📞',
    templates: [
      '{winner}, service excuses ouvert 24h/24. 📞',
      "{votes} personnes ont déjà un alibi prêt grâce à {winner}.",
      "L'excuse de {winner} sera parfaite. Trop parfaite, même.",
    ],
  },
  {
    id: 'q24',
    text: 'Tu dois gagner un débat : qui tu envoies à ta place ?',
    category: 'scenario',
    emoji: '⚖️',
    templates: [
      '{winner} entre dans le débat. Le débat se termine. ⚖️',
      '{pct} % du groupe préfère envoyer {winner} plutôt que de parler.',
      "{winner}, tu n'as même pas besoin d'avoir raison pour gagner.",
    ],
  },
  {
    id: 'q25',
    text: 'Tu participes à une émission de survie : qui tu prends dans ton équipe ?',
    category: 'scenario',
    emoji: '🏕️',
    templates: [
      '{winner} dans l\'équipe : {votes} personnes se sentent déjà plus tranquilles. 🏕️',
      '{winner} fera le feu. Les autres feront des photos.',
      'Équipe {winner} : {pct} % de chances de survie estimées par le groupe.',
    ],
  },
  {
    id: 'q26',
    text: 'T’as fait une énorme bourde et tu paniques : qui est ton premier appel ?',
    category: 'scenario',
    emoji: '🚨',
    templates: [
      '{winner} décroche, ne juge pas, et trouve une solution. 🚨',
      "{votes} personnes ont {winner} en numéro 1 des urgences.",
      "{winner}, tu es officiellement le plan de secours du groupe.",
    ],
  },
  {
    id: 'q27',
    text: 'Tu dois monter un business et devenir riche : qui tu prends comme associée ?',
    category: 'scenario',
    emoji: '💼',
    templates: [
      '{winner}, associée choisie à {pct} %. Le contrat est déjà signé. 💼',
      "{votes} personnes veulent monter une boîte avec {winner}. Ça commence bien.",
      "{winner} gère la stratégie. Les autres gèrent l'ambiance.",
    ],
  },
  {
    id: 'q28',
    text: 'Tu dois faire rire une salle entière : qui tu envoies ?',
    category: 'scenario',
    emoji: '🎭',
    templates: [
      '{winner} monte sur scène. La salle est déjà conquise. 🎭',
      "{pct} % du groupe fait confiance à {winner} pour sauver la soirée.",
      "{winner} n'a même pas besoin de texte.",
    ],
  },
  {
    id: 'q29',
    text: 'Tu dois passer 24h sans téléphone avec une seule personne : qui tu choisis ?',
    category: 'scenario',
    emoji: '🔌',
    templates: [
      '24h sans téléphone avec {winner} : {votes} personnes sont partantes. 🔌',
      "Avec {winner}, personne ne remarquerait même l'absence de réseau.",
      '{winner}, tu es officiellement plus divertissante que le wifi.',
    ],
  },
  {
    id: 'q30',
    text: 'Vous êtes toutes coincées sur une île : qui devient naturellement la cheffe ?',
    category: 'scenario',
    emoji: '🏝️',
    templates: [
      '{winner} prend le commandement à {pct} %. Personne ne conteste. 🏝️',
      "Sur l'île, {winner} organise tout. Les autres suivent.",
      '{votes} personnes ont déjà accepté leur nouvelle cheffe : {winner}.',
    ],
  },
  {
    id: 'q31',
    text: 'Tu gagnes un voyage demain matin avec une seule place supplémentaire : qui tu emmènes ?',
    category: 'scenario',
    emoji: '✈️',
    templates: [
      '{winner}, prépare ta valise. {votes} personnes te réclament. ✈️',
      'Une seule place, aucune hésitation : {winner}.',
      '{winner} part demain. Les autres regarderont les stories.',
    ],
  },
  {
    id: 'q32',
    text: 'T’as fait LA plus grosse bêtise de ta vie et personne ne doit l’apprendre : qui tu appelles en premier ?',
    category: 'scenario',
    emoji: '🤫',
    templates: [
      "{winner}, gardienne officielle des dossiers du groupe. 🤫",
      "{votes} personnes font confiance à {winner} pour ne jamais rien dire.",
      "Avec {winner}, l'affaire est classée avant même d'être ouverte.",
    ],
  },
];

/** Prenoms de demonstration, modifiables par l'hote avant la partie. */
export const DEMO_NAMES: string[] = [
  'Inès',
  'Lina',
  'Sarah',
  'Nour',
  'Jade',
  'Maya',
  'Yasmine',
  'Sofia',
  'Imane',
  'Aya',
  'Kenza',
  'Léa',
  'Manel',
  'Amel',
  'Selma',
  'Myriam',
  'Lyna',
  'Assia',
];
