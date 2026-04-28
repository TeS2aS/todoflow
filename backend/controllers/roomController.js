const gameService = require('../services/gameService');
const roomService = require('../services/roomService');

async function createRoom(req, res, next) {
  try {
    const room = await roomService.createRoom(req.userId, req.body);
    return res.status(201).json(room);
  } catch (error) {
    return next(error);
  }
}

async function joinRoom(req, res, next) {
  try {
    const room = await roomService.joinRoom(req.userId, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function getRoom(req, res, next) {
  try {
    const room = await roomService.getRoomState(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function leaveRoom(req, res, next) {
  try {
    const result = await roomService.leaveRoom(req.userId, req.params.code);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function setReady(req, res, next) {
  try {
    const room = await roomService.setReady(req.userId, req.params.code, req.body.isReady);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function startRoom(req, res, next) {
  try {
    const room = await gameService.startGame(req.userId, req.params.code, {
      gameType: req.body.gameType || 'speed_todo'
    });
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function getScores(req, res, next) {
  try {
    const scores = await roomService.getScores(req.userId, req.params.code);
    return res.json(scores);
  } catch (error) {
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await roomService.getHistory(req.userId, req.params.code);
    return res.json(history);
  } catch (error) {
    return next(error);
  }
}

async function getMessages(req, res, next) {
  try {
    const messages = await roomService.getMessages(req.userId, req.params.code);
    return res.json(messages);
  } catch (error) {
    return next(error);
  }
}

async function createMessage(req, res, next) {
  try {
    const messages = await roomService.createMessage(req.userId, req.params.code, req.body);
    return res.status(201).json(messages);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createMessage,
  createRoom,
  getHistory,
  getMessages,
  getRoom,
  getScores,
  joinRoom,
  leaveRoom,
  setReady,
  startRoom
};
