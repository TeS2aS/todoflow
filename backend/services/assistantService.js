const AssistantProfile = require('../models/AssistantProfile');
const Task = require('../models/Task');
const ApiError = require('../utils/apiError');
const {
  normalizeText,
  validateSafeText
} = require('../utils/validators');

const ALLOWED_TONES = new Set(['drole', 'strict', 'calme', 'professionnel', 'sarcastique_soft', 'coach_sportif']);
const ALLOWED_GOALS = new Set(['productivite', 'motivation', 'organisation', 'apprentissage', 'fun']);
const PRESETS = {
  mambo: {
    preset: 'mambo',
    name: 'Mambo',
    avatar: 'M',
    color: '#f0b64d',
    personality: 'Coach chaotique, drole, motivant et bienveillant.',
    tone: 'drole',
    goals: ['productivite', 'motivation', 'fun'],
    intensity: 4,
    catchphrases: [
      'On transforme ce bazar en plan de bataille joyeux.',
      'Une petite victoire maintenant, un grand sourire apres.'
    ]
  },
  kratos: {
    preset: 'kratos',
    name: 'Kratos',
    avatar: 'K',
    color: '#ba2d22',
    personality: 'Mentor strict, direct, discipline et guerrier.',
    tone: 'strict',
    goals: ['productivite', 'organisation', 'motivation'],
    intensity: 5,
    catchphrases: [
      'Objectif. Action. Resultat.',
      'La discipline finit la tache.'
    ]
  }
};

function clampIntensity(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.max(1, Math.min(5, parsed));
}

function normalizeColor(value, fallback = '#0b7a75') {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeList(value, allowed, max = 6) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => normalizeText(item).toLowerCase()).filter((item) => allowed.has(item)))]
    .slice(0, max);
}

function normalizeCatchphrases(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item).slice(0, 120))
    .filter(Boolean)
    .filter((item) => !validateSafeText('Catchphrase', item, { min: 1, max: 120 }))
    .slice(0, 8);
}

function buildPresetPayload(preset) {
  const payload = PRESETS[preset];

  if (!payload) {
    throw new ApiError(400, 'Assistant preset is invalid');
  }

  return payload;
}

async function getProfileOrDefault(userId) {
  const profile = await AssistantProfile.findOne({ userId }).lean();

  if (profile) {
    return profile;
  }

  return {
    userId,
    ...PRESETS.mambo
  };
}

async function listAssistants() {
  return Object.values(PRESETS);
}

async function selectAssistant(userId, preset) {
  const payload = buildPresetPayload(normalizeText(preset).toLowerCase());

  return AssistantProfile.findOneAndUpdate(
    { userId },
    { $set: { userId, ...payload } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function buildCustomPayload(body) {
  const name = normalizeText(body.name).slice(0, 40);
  const nameError = validateSafeText('Assistant name', name, { min: 2, max: 40 });

  if (nameError) {
    throw new ApiError(400, nameError);
  }

  const tone = normalizeText(body.tone).toLowerCase() || 'professionnel';

  if (!ALLOWED_TONES.has(tone)) {
    throw new ApiError(400, 'Assistant tone is invalid');
  }

  const goals = normalizeList(body.goals, ALLOWED_GOALS, 5);

  if (!goals.length) {
    goals.push('productivite');
  }

  const avatar = normalizeText(body.avatar || name.charAt(0).toUpperCase()).slice(0, 300);
  const personality = normalizeText(body.personality || `Assistant ${tone}`).slice(0, 160);

  return {
    preset: 'custom',
    name,
    avatar,
    color: normalizeColor(body.color),
    personality,
    tone,
    goals,
    intensity: clampIntensity(body.intensity),
    catchphrases: normalizeCatchphrases(body.catchphrases)
  };
}

async function createCustomAssistant(userId, body) {
  const payload = buildCustomPayload(body || {});

  return AssistantProfile.findOneAndUpdate(
    { userId },
    { $set: { userId, ...payload } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function updateAssistant(userId, body) {
  const input = body || {};
  const current = await getProfileOrDefault(userId);
  const payload = buildCustomPayload({ ...current, ...input, name: input.name || current.name });

  return AssistantProfile.findOneAndUpdate(
    { userId },
    { $set: { userId, ...payload } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function priorityLabel(priority) {
  return {
    high: 'haute',
    medium: 'moyenne',
    low: 'basse'
  }[priority] || 'moyenne';
}

async function getTaskSnapshot(userId) {
  const tasks = await Task.find({ userId }).sort({ dueDate: 1, priority: -1, updatedAt: -1 }).limit(80).lean();
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const active = tasks.filter((task) => !task.completed);
  const completed = tasks.filter((task) => task.completed);
  const overdue = active.filter((task) => task.dueDate && new Date(task.dueDate) < todayStart);
  const priorityCounts = active.reduce((counts, task) => {
    counts[task.priority] = (counts[task.priority] || 0) + 1;
    return counts;
  }, {});
  const dominantPriority = Object.entries(priorityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

  return {
    tasks,
    active,
    completed,
    overdue,
    dueSoon: active.filter((task) => task.dueDate && new Date(task.dueDate) <= new Date(now.getTime() + 48 * 60 * 60 * 1000)),
    dominantPriority
  };
}

function styleLine(profile, core) {
  const intensity = Number(profile.intensity || 3);

  if (profile.preset === 'kratos' || profile.tone === 'strict') {
    return `${core} Fais-le maintenant.`;
  }

  if (profile.preset === 'mambo' || profile.tone === 'drole') {
    return `${core} Petit sprint, grand panache.`;
  }

  if (profile.tone === 'calme') {
    return `${core} Avance simplement, une etape a la fois.`;
  }

  if (profile.tone === 'coach_sportif') {
    return `${core} Serie propre: ${intensity} minutes de focus.`;
  }

  if (profile.tone === 'sarcastique_soft') {
    return `${core} Rien d impossible, meme pour un agenda qui tente le theatre.`;
  }

  return `${core} Priorise, execute, puis ajuste.`;
}

function buildSuggestions(profile, snapshot) {
  const suggestions = [];

  if (snapshot.overdue.length) {
    suggestions.push({
      title: `Rattraper ${snapshot.overdue[0].title}`,
      priority: 'high',
      tags: ['assistant', profile.name.toLowerCase()]
    });
  }

  if (snapshot.dueSoon.length) {
    suggestions.push({
      title: `Bloquer 25 minutes pour ${snapshot.dueSoon[0].title}`,
      priority: snapshot.dueSoon[0].priority || 'medium',
      tags: ['focus']
    });
  }

  suggestions.push(
    {
      title: profile.preset === 'kratos' ? 'Terminer une tache haute priorite' : 'Choisir une mini-victoire de 10 minutes',
      priority: 'high',
      tags: ['focus']
    },
    {
      title: 'Nettoyer les taches sans echeance',
      priority: 'medium',
      tags: ['organisation']
    },
    {
      title: profile.preset === 'mambo' ? 'Defi fun: finir 3 petites taches' : 'Revue rapide des objectifs du jour',
      priority: 'medium',
      tags: ['assistant']
    }
  );

  return suggestions.slice(0, 5);
}

function rewriteTaskTitle(profile, title) {
  const cleanTitle = normalizeText(title).slice(0, 120);

  if (!cleanTitle) {
    return '';
  }

  if (profile.preset === 'kratos' || profile.tone === 'strict') {
    return `Finaliser: ${cleanTitle}`;
  }

  if (profile.preset === 'mambo' || profile.tone === 'drole') {
    return `Transformer en victoire: ${cleanTitle}`;
  }

  if (profile.tone === 'calme') {
    return `Avancer doucement sur ${cleanTitle}`;
  }

  if (profile.tone === 'coach_sportif') {
    return `Sprint focus: ${cleanTitle}`;
  }

  return `Clarifier et terminer ${cleanTitle}`;
}

async function buildAssistantPayload(userId, body = {}) {
  const profile = await getProfileOrDefault(userId);
  const snapshot = await getTaskSnapshot(userId);
  const title = normalizeText(body.title || body.message || '');

  return {
    profile,
    suggestions: buildSuggestions(profile, snapshot),
    rewrite: rewriteTaskTitle(profile, title),
    message: styleLine(profile, snapshot.overdue.length
      ? `Tu as ${snapshot.overdue.length} tache(s) en retard.`
      : `Priorite dominante: ${priorityLabel(snapshot.dominantPriority)}.`),
    analysis: {
      overdue: snapshot.overdue.length,
      completed: snapshot.completed.length,
      active: snapshot.active.length,
      dominantPriority: snapshot.dominantPriority,
      advice: styleLine(profile, snapshot.overdue.length
        ? 'Commence par la plus ancienne tache en retard.'
        : 'Garde le prochain bloc de travail court et net.')
    }
  };
}

async function getDailyMessage(userId) {
  const profile = await getProfileOrDefault(userId);
  const snapshot = await getTaskSnapshot(userId);
  const phrase = profile.catchphrases?.[new Date().getDate() % Math.max(1, profile.catchphrases.length)] || '';

  return {
    profile,
    message: phrase || styleLine(profile, `Aujourd hui: ${snapshot.active.length} tache(s) active(s), ${snapshot.overdue.length} en retard.`)
  };
}

async function rewriteTask(userId, body) {
  const profile = await getProfileOrDefault(userId);
  const title = normalizeText(body.title || body.text || '').slice(0, 120);

  if (!title) {
    throw new ApiError(400, 'Task title is required');
  }

  return {
    rewrite: rewriteTaskTitle(profile, title),
    profile
  };
}

module.exports = {
  buildAssistantPayload,
  createCustomAssistant,
  getDailyMessage,
  getProfileOrDefault,
  listAssistants,
  rewriteTask,
  selectAssistant,
  updateAssistant
};
