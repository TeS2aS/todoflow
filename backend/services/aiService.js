const Task = require('../models/Task');
const { normalizeText } = require('../utils/validators');
const { scoreTask } = require('./taskService');

const suggestionTemplates = [
  'Planifier la priorite la plus importante de demain',
  'Regrouper les petites taches en un bloc de 30 minutes',
  'Revoir les taches sans date limite',
  'Decouper la prochaine grosse tache en sous-taches',
  'Archiver ou terminer les taches bloquees'
];

function inferPriority(title) {
  const text = normalizeText(title, 160).toLowerCase();

  if (/urgent|important|bloquant|deadline|client|prod/.test(text)) {
    return 'high';
  }

  if (/plus tard|idee|lecture|veille|optionnel/.test(text)) {
    return 'low';
  }

  return 'medium';
}

function reformulate(title) {
  const cleanTitle = normalizeText(title, 120);

  if (!cleanTitle) {
    return '';
  }

  const startsWithVerb = /^(faire|creer|corriger|preparer|envoyer|verifier|planifier|revoir|mettre|finaliser)\b/i.test(cleanTitle);

  if (startsWithVerb) {
    return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  return `Finaliser ${cleanTitle.charAt(0).toLowerCase()}${cleanTitle.slice(1)}`;
}

async function getAssistantResponse(userId, input = {}) {
  const tasks = await Task.find({ userId }).sort({ updatedAt: -1 }).limit(50).lean();
  const activeTasks = tasks.filter((task) => !task.completed);
  const scoredTasks = activeTasks
    .map((task) => ({ task, score: scoreTask(task) }))
    .sort((a, b) => b.score - a.score);

  const suggestions = suggestionTemplates.slice(0, 3).map((title, index) => ({
    title,
    priority: index === 0 ? 'high' : 'medium',
    tags: ['assistant']
  }));

  const title = input.title ? normalizeText(input.title, 120) : '';

  return {
    suggestions,
    rewrite: title ? reformulate(title) : '',
    inferredPriority: title ? inferPriority(title) : '',
    nextBestTask: scoredTasks[0]?.task || null,
    planningTips: analyzeHabits(tasks).tips
  };
}

function analyzeHabits(tasks) {
  const completed = tasks.filter((task) => task.completed).length;
  const withoutDueDate = tasks.filter((task) => !task.completed && !task.dueDate).length;
  const highOpen = tasks.filter((task) => !task.completed && task.priority === 'high').length;
  const tips = [];

  if (withoutDueDate > 2) {
    tips.push('Ajoutez une date limite aux taches actives sans echeance pour reduire le flou.');
  }

  if (highOpen > 3) {
    tips.push('Limitez les priorites hautes a trois elements pour garder un vrai focus.');
  }

  if (tasks.length && completed / tasks.length < 0.35) {
    tips.push('Essayez de decouper les taches longues en sous-taches plus courtes.');
  }

  if (!tips.length) {
    tips.push('Votre tableau est equilibre: gardez un rituel court de revue quotidienne.');
  }

  return {
    completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    withoutDueDate,
    highOpen,
    tips
  };
}

async function analyzeUser(userId) {
  const tasks = await Task.find({ userId }).sort({ createdAt: -1 }).limit(200).lean();
  return analyzeHabits(tasks);
}

module.exports = {
  analyzeUser,
  getAssistantResponse
};
