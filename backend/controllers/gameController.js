const gameService = require('../services/gameService');

async function listGames(req, res, next) {
  try {
    return res.json(gameService.listGames());
  } catch (error) {
    return next(error);
  }
}

async function startGame(req, res, next) {
  try {
    const room = await gameService.startGame(req.userId, req.params.code, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function submitGame(req, res, next) {
  try {
    const room = await gameService.submitGame(req.userId, req.params.code, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function voteGame(req, res, next) {
  try {
    const room = await gameService.voteGame(req.userId, req.params.code, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function endRound(req, res, next) {
  try {
    const room = await gameService.endRound(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function resetToLobby(req, res, next) {
  try {
    const room = await gameService.resetToLobby(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function createBattleRoom(req, res, next) {
  try {
    const room = await gameService.createBattleRoom(req.userId, req.body);
    return res.status(201).json(room);
  } catch (error) {
    return next(error);
  }
}

async function joinBattleRoom(req, res, next) {
  try {
    const room = await gameService.joinBattleRoom(req.userId, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function getBattleRoom(req, res, next) {
  try {
    const room = await gameService.getBattleRoom(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function setBattleReady(req, res, next) {
  try {
    const room = await gameService.setBattleReady(req.userId, req.params.code, req.body.isReady);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function startBattleRoom(req, res, next) {
  try {
    const room = await gameService.startBattleRoom(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function submitBattleResponse(req, res, next) {
  try {
    const submission = await gameService.submitBattleResponse(req.userId, req.params.code, req.body);
    return res.status(201).json(submission);
  } catch (error) {
    return next(error);
  }
}

async function listBattleSubmissions(req, res, next) {
  try {
    const submissions = await gameService.listBattleSubmissions(req.userId, req.params.code);
    return res.json(submissions);
  } catch (error) {
    return next(error);
  }
}

async function voteBattleSubmission(req, res, next) {
  try {
    const room = await gameService.voteBattleSubmission(req.userId, req.params.code, req.body);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

async function getBattleResults(req, res, next) {
  try {
    const results = await gameService.getBattleResults(req.userId, req.params.code);
    return res.json(results);
  } catch (error) {
    return next(error);
  }
}

async function finishBattleRoom(req, res, next) {
  try {
    const room = await gameService.finishBattleRoom(req.userId, req.params.code);
    return res.json(room);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBattleRoom,
  endRound,
  finishBattleRoom,
  getBattleResults,
  getBattleRoom,
  listGames,
  joinBattleRoom,
  listBattleSubmissions,
  resetToLobby,
  setBattleReady,
  startGame,
  startBattleRoom,
  submitBattleResponse,
  submitGame,
  voteBattleSubmission,
  voteGame
};
