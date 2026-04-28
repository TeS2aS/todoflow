const chatService = require('../services/chatService');

async function getMessages(req, res, next) {
  try {
    const messages = await chatService.listMessages(req.userId, req.query);
    return res.json(messages);
  } catch (error) {
    return next(error);
  }
}

async function createMessage(req, res, next) {
  try {
    const message = await chatService.createMessage(req.userId, req.body);
    return res.status(201).json(message);
  } catch (error) {
    return next(error);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const result = await chatService.deleteMessage(req.userId, req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function toggleReaction(req, res, next) {
  try {
    const message = await chatService.toggleReaction(req.userId, req.params.id, req.body.emoji);
    return res.json(message);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createMessage,
  deleteMessage,
  getMessages,
  toggleReaction
};
