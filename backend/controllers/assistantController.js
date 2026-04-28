const assistantService = require('../services/assistantService');

async function listAssistants(req, res, next) {
  try {
    const assistants = await assistantService.listAssistants();
    return res.json(assistants);
  } catch (error) {
    return next(error);
  }
}

async function getMyAssistant(req, res, next) {
  try {
    const profile = await assistantService.getProfileOrDefault(req.userId);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function selectAssistant(req, res, next) {
  try {
    const profile = await assistantService.selectAssistant(req.userId, req.body.preset || req.body.name);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function createCustomAssistant(req, res, next) {
  try {
    const profile = await assistantService.createCustomAssistant(req.userId, req.body);
    return res.status(201).json(profile);
  } catch (error) {
    return next(error);
  }
}

async function updateAssistant(req, res, next) {
  try {
    const profile = await assistantService.updateAssistant(req.userId, req.body);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function messageAssistant(req, res, next) {
  try {
    const payload = await assistantService.buildAssistantPayload(req.userId, req.body);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function rewriteTask(req, res, next) {
  try {
    const payload = await assistantService.rewriteTask(req.userId, req.body);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getDailyMessage(req, res, next) {
  try {
    const payload = await assistantService.getDailyMessage(req.userId);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createCustomAssistant,
  getDailyMessage,
  getMyAssistant,
  listAssistants,
  messageAssistant,
  rewriteTask,
  selectAssistant,
  updateAssistant
};
