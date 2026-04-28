const AVATAR_OPTIONS = [
  '😀', '😎', '🤠', '🥳', '🤖',
  '👻', '🧠', '🔥', '🍕', '🚀',
  '🎲', '🎯', '🏆', '⚡', '🌈',
  '🦄', '🐙', '🧃', '🕺', '💡'
];

const SPEED_TODO_CATEGORIES = new Set(['useful', 'funny', 'chaotic']);

const GAME_CATALOG = [
  {
    id: 'speed_todo',
    name: 'Speed Todo',
    status: 'available',
    minPlayers: 1,
    summary: 'Ecrivez le plus de taches utiles ou absurdes avant la fin du timer.'
  },
  {
    id: 'task_battle',
    name: 'Task Battle',
    status: 'planned',
    minPlayers: 2,
    summary: 'Proposez la mission la plus drole, puis votez.'
  },
  {
    id: 'who_would',
    name: 'Qui ferait ca ?',
    status: 'planned',
    minPlayers: 3,
    summary: 'Votez pour la personne la plus susceptible de faire une action absurde.'
  },
  {
    id: 'task_impostor',
    name: 'Imposteur de tache',
    status: 'planned',
    minPlayers: 4,
    summary: 'Trouvez qui n a pas recu le theme commun.'
  },
  {
    id: 'challenge_roulette',
    name: 'Defi Roulette',
    status: 'planned',
    minPlayers: 2,
    summary: 'Une categorie tiree au hasard donne un defi a valider.'
  },
  {
    id: 'chaos_vote',
    name: 'Vote du chaos',
    status: 'planned',
    minPlayers: 2,
    summary: 'Votez une regle absurde pour la prochaine manche.'
  },
  {
    id: 'party_bingo',
    name: 'Bingo de soiree',
    status: 'planned',
    minPlayers: 2,
    summary: 'Cochez les evenements qui arrivent pendant la soiree.'
  }
];

const FUNNY_SUMMARIES = [
  'Le classement est injuste, mais officiel.',
  'Mission acceptee. Dignite non garantie.',
  'Le serveur a survecu. Pas sur pour vos amities.',
  'Quelqu un va regretter ce vote.',
  'Productivite detectee. On appelle ca un accident heureux.'
];

function pickFunnySummary(seed = 0) {
  return FUNNY_SUMMARIES[Math.abs(seed) % FUNNY_SUMMARIES.length];
}

module.exports = {
  AVATAR_OPTIONS,
  GAME_CATALOG,
  SPEED_TODO_CATEGORIES,
  pickFunnySummary
};
