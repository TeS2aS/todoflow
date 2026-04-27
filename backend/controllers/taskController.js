const aiService = require('../services/aiService');
const taskService = require('../services/taskService');

async function getTasks(req, res, next) {
  try {
    const result = await taskService.listTasks(req.userId, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function createTask(req, res, next) {
  try {
    const task = await taskService.createTask(req.userId, req.body);
    return res.status(201).json(task);
  } catch (error) {
    return next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(req.userId, req.params.id, req.body);
    return res.json(task);
  } catch (error) {
    return next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const result = await taskService.deleteTask(req.userId, req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function reorderTasks(req, res, next) {
  try {
    const result = await taskService.reorderTasks(req.userId, req.body.orderedIds);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await taskService.getStats(req.userId);
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
}

async function exportTasks(req, res, next) {
  try {
    const payload = await taskService.exportTasks(req.userId);
    res.setHeader('Content-Disposition', 'attachment; filename="todoflow-export.json"');
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getAssistant(req, res, next) {
  try {
    const response = await aiService.getAssistantResponse(req.userId, req.body);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

async function getAnalysis(req, res, next) {
  try {
    const response = await aiService.analyzeUser(req.userId);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTask,
  deleteTask,
  exportTasks,
  getAnalysis,
  getAssistant,
  getStats,
  getTasks,
  reorderTasks,
  updateTask
};
