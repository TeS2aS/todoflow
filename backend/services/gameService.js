const mongoose = require('mongoose');

const GameHistory = require('../models/GameHistory');
const GamePlayer = require('../models/GamePlayer');
const GameRoom = require('../models/GameRoom');
const GameSession = require('../models/GameSession');
const GameSubmission = require('../models/GameSubmission');
const GameVote = require('../models/GameVote');
const GroupMember = require('../models/GroupMember');
const Player = require('../models/Player');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const {
  GAME_CATALOG,
  SPEED_TODO_CATEGORIES,
  pickFunnySummary
} = require('../utils/gameRules');
const {
  normalizeText,
  validateObjectId,
  validateSafeText
} = require('../utils/validators');
const { generateRoomCode, normalizeRoomCode } = require('../utils/roomCode');
const roomService = require('./roomService');

const IMPLEMENTED_GAMES = new Set(['speed_todo']);
const MAX_SPEED_TODO_ITEMS = 10;

function listGames() {
  return GAME_CATALOG;
}

function normalizeGameType(value) {
  const gameType = normalizeText(value || 'speed_todo').toLowerCase();

  if (!IMPLEMENTED_GAMES.has(gameType)) {
    throw new ApiError(400, 'This game is planned but not available in V1');
  }

  return gameType;
}

function normalizeSpeedTodoItems(body) {
  const rawItems = Array.isArray(body.items)
    ? body.items
    : String(body.text || '')
      .split('\n')
      .map((line) => line.trim());

  const items = rawItems
    .map((item) => normalizeText(item).slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_SPEED_TODO_ITEMS)
    .map((text) => {
      const error = validateSafeText('Task idea', text, { min: 1, max: 120 });

      if (error) {
        throw new ApiError(400, error);
      }

      return { text, createdAt: new Date() };
    });

  if (!items.length) {
    throw new ApiError(400, 'At least one task idea is required');
  }

  return items;
}

async function getActiveSession(roomId) {
  return GameSession.findOne({
    roomId,
    status: { $in: ['waiting', 'collecting', 'voting'] }
  }).sort({ createdAt: -1 });
}

async function requireActiveSession(roomId) {
  const session = await getActiveSession(roomId);

  if (!session) {
    throw new ApiError(404, 'No active game session');
  }

  return session;
}

async function startGame(userId, code, body = {}) {
  const room = await roomService.findRoomByCode(code);
  await roomService.requireRoomHost(room, userId);

  const gameType = normalizeGameType(body.gameType || body.currentGame);
  const activeSession = await getActiveSession(room._id);

  if (activeSession && activeSession.status !== 'finished') {
    throw new ApiError(409, 'A game is already running in this room');
  }

  const playersCount = await Player.countDocuments({ roomId: room._id, connected: true });

  if (playersCount < 1) {
    throw new ApiError(409, 'At least one player is required');
  }

  const round = (room.currentRound || 0) + 1;

  await GameSession.create({
    roomId: room._id,
    gameType,
    status: 'collecting',
    round,
    prompts: [{
      text: 'Ecrivez des taches utiles, droles ou franchement discutables avant la fin du timer.',
      category: 'speed'
    }],
    startedAt: new Date()
  });

  room.status = 'playing';
  room.currentGame = gameType;
  room.currentRound = round;
  await room.save();

  await roomService.addSystemMessage(room._id, 'Speed Todo demarre. Mission acceptee. Dignite non garantie.', 'game');

  return roomService.buildRoomState(room, userId);
}

async function submitGame(userId, code, body) {
  const room = await roomService.findRoomByCode(code);
  const player = await roomService.requireRoomPlayer(room, userId);
  const session = await requireActiveSession(room._id);

  if (session.gameType !== 'speed_todo') {
    throw new ApiError(400, 'This game does not accept Speed Todo submissions');
  }

  if (session.status !== 'collecting') {
    throw new ApiError(409, 'Submissions are closed for this round');
  }

  const items = normalizeSpeedTodoItems(body || {});
  session.submissions = (session.submissions || []).filter((submission) => {
    return String(submission.playerId) !== String(player._id);
  });
  session.submissions.push({
    playerId: player._id,
    nickname: player.nickname,
    avatar: player.avatar,
    items,
    submittedAt: new Date()
  });

  player.lastSeen = new Date();
  await Promise.all([session.save(), player.save()]);

  await roomService.addSystemMessage(room._id, `${player.nickname} a envoye ${items.length} idee(s).`, 'game');

  return roomService.buildRoomState(room, userId);
}

function findSubmission(session, submissionId) {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    throw new ApiError(400, 'Submission id is invalid');
  }

  const submission = session.submissions.id(submissionId);

  if (!submission) {
    throw new ApiError(404, 'Submission not found');
  }

  return submission;
}

async function voteGame(userId, code, body) {
  const room = await roomService.findRoomByCode(code);
  const player = await roomService.requireRoomPlayer(room, userId);
  const session = await requireActiveSession(room._id);

  if (session.status !== 'voting') {
    throw new ApiError(409, 'Votes are not open yet');
  }

  const category = normalizeText(body.category).toLowerCase();

  if (!SPEED_TODO_CATEGORIES.has(category)) {
    throw new ApiError(400, 'Vote category is invalid');
  }

  const submission = findSubmission(session, body.submissionId);
  const itemIndex = Number.parseInt(body.itemIndex, 10);

  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= submission.items.length) {
    throw new ApiError(400, 'Vote item is invalid');
  }

  if (String(submission.playerId) === String(player._id)) {
    throw new ApiError(400, 'Self votes are blocked because friendship deserves a chance');
  }

  session.votes = (session.votes || []).filter((vote) => {
    return !(String(vote.playerId) === String(player._id) && vote.category === category);
  });
  session.votes.push({
    playerId: player._id,
    category,
    submissionId: submission._id,
    itemIndex,
    targetPlayerId: submission.playerId,
    createdAt: new Date()
  });

  player.lastSeen = new Date();
  await Promise.all([session.save(), player.save()]);

  return roomService.buildRoomState(room, userId);
}

function addPoints(scoreMap, playerId, points, reason) {
  const key = String(playerId);
  const score = scoreMap.get(key);

  if (!score) {
    return;
  }

  score.points += points;
  score.breakdown.push(reason);
}

function scoreSpeedTodo(session, players) {
  const scoreMap = new Map(players.map((player) => [
    String(player._id),
    {
      playerId: player._id,
      nickname: player.nickname,
      avatar: player.avatar,
      points: 0,
      breakdown: []
    }
  ]));

  (session.submissions || []).forEach((submission) => {
    const validItems = (submission.items || []).length;

    if (validItems) {
      addPoints(scoreMap, submission.playerId, validItems, `+${validItems} idee(s) valide(s)`);
    }
  });

  const voteBonuses = {
    useful: { points: 3, label: 'idee la plus utile' },
    funny: { points: 3, label: 'idee la plus drole' },
    chaotic: { points: 2, label: 'idee la plus chaotique' }
  };

  Object.entries(voteBonuses).forEach(([category, bonus]) => {
    const groupedVotes = new Map();

    (session.votes || [])
      .filter((vote) => vote.category === category)
      .forEach((vote) => {
        const key = `${vote.submissionId}:${vote.itemIndex}`;
        groupedVotes.set(key, (groupedVotes.get(key) || 0) + 1);
      });

    if (!groupedVotes.size) {
      return;
    }

    const bestCount = Math.max(...groupedVotes.values());

    groupedVotes.forEach((count, key) => {
      if (count !== bestCount) {
        return;
      }

      const [submissionId, itemIndexRaw] = key.split(':');
      const itemIndex = Number.parseInt(itemIndexRaw, 10);
      const submission = (session.submissions || []).find((item) => String(item._id) === submissionId);

      if (submission && submission.items[itemIndex]) {
        addPoints(scoreMap, submission.playerId, bonus.points, `+${bonus.points} ${bonus.label}`);
      }
    });
  });

  return [...scoreMap.values()].sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname));
}

async function finishSpeedTodo(room, session) {
  const players = await Player.find({ roomId: room._id, connected: true }).sort({ createdAt: 1 });
  const roundScores = scoreSpeedTodo(session, players);

  await Promise.all(roundScores.map((score) => {
    if (!score.points) {
      return Promise.resolve();
    }

    return Player.updateOne({ _id: score.playerId }, { $inc: { score: score.points } });
  }));

  const updatedPlayers = await Player.find({ roomId: room._id }).sort({ score: -1, updatedAt: 1 }).lean();
  const topScore = Math.max(0, ...updatedPlayers.map((player) => player.score || 0));
  const winners = updatedPlayers
    .filter((player) => (player.score || 0) === topScore)
    .map((player) => ({
      playerId: player._id,
      nickname: player.nickname,
      avatar: player.avatar,
      score: player.score || 0
    }));
  const finalScores = updatedPlayers.map((player) => ({
    playerId: player._id,
    nickname: player.nickname,
    avatar: player.avatar,
    score: player.score || 0
  }));
  const funnySummary = pickFunnySummary(roundScores.reduce((total, score) => total + score.points, 0));

  session.status = 'finished';
  session.scores = roundScores;
  session.endedAt = new Date();
  room.status = 'finished';

  await Promise.all([
    session.save(),
    room.save(),
    GameHistory.create({
      roomId: room._id,
      winners,
      finalScores,
      funnySummary
    }),
    roomService.addSystemMessage(room._id, funnySummary, 'game')
  ]);
}

async function endRound(userId, code) {
  const room = await roomService.findRoomByCode(code);
  await roomService.requireRoomHost(room, userId);
  const session = await requireActiveSession(room._id);

  if (session.status === 'collecting') {
    session.status = 'voting';
    await session.save();
    await roomService.addSystemMessage(room._id, 'Place aux votes. Le chaos entre dans sa phase administrative.', 'game');
    return roomService.buildRoomState(room, userId);
  }

  if (session.status === 'voting') {
    await finishSpeedTodo(room, session);
    return roomService.buildRoomState(room, userId);
  }

  return roomService.buildRoomState(room, userId);
}

async function resetToLobby(userId, code) {
  const room = await roomService.findRoomByCode(code);
  await roomService.requireRoomHost(room, userId);

  room.status = 'lobby';
  room.currentGame = '';
  await room.save();

  await Player.updateMany({ roomId: room._id, connected: true }, { $set: { isReady: false } });
  await roomService.addSystemMessage(room._id, 'Retour au lobby. Les amities peuvent respirer.', 'game');

  return roomService.buildRoomState(room, userId);
}

const BATTLE_GAME_ID = 'speed_tasks_battle';
const BATTLE_CATEGORIES = new Set(['funny', 'useful', 'chaotic']);
const BATTLE_CATEGORY_POINTS = {
  funny: 3,
  useful: 3,
  chaotic: 2
};

function toId(value) {
  return value ? String(value) : '';
}

function normalizeBattleNickname(value, fallback) {
  const nickname = normalizeText(value || fallback || 'Player').slice(0, 32);
  const error = validateSafeText('Nickname', nickname, { min: 2, max: 32 });

  if (error) {
    throw new ApiError(400, error);
  }

  return nickname;
}

function normalizeBattleTheme(value) {
  const theme = normalizeText(value || 'Idees de taches utiles pour demain').slice(0, 120);
  const error = validateSafeText('Theme', theme, { min: 2, max: 120 });

  if (error) {
    throw new ApiError(400, error);
  }

  return theme;
}

function userFallbackName(user) {
  return String(user?.email || 'player').split('@')[0].slice(0, 28) || 'Player';
}

async function getBattleUser(userId) {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(401, 'Authentication token is invalid');
  }

  return user;
}

async function ensureBattleCode() {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const code = generateRoomCode(6);
    const existing = await GameRoom.exists({ code });

    if (!existing) {
      return code;
    }
  }

  throw new ApiError(500, 'Unable to generate room code');
}

async function assertGroupAccess(groupId, userId) {
  if (!groupId) {
    return;
  }

  if (!validateObjectId(groupId)) {
    throw new ApiError(400, 'Group id is invalid');
  }

  const membership = await GroupMember.exists({ groupId, userId });

  if (!membership) {
    throw new ApiError(403, 'You must belong to this group');
  }
}

async function findBattleRoom(code) {
  const normalizedCode = normalizeRoomCode(code);

  if (!/^[A-Z0-9]{4,8}$/.test(normalizedCode)) {
    throw new ApiError(400, 'Room code is invalid');
  }

  const room = await GameRoom.findOne({ code: normalizedCode });

  if (!room) {
    throw new ApiError(404, 'Game room not found');
  }

  if (room.currentGame && room.currentGame !== BATTLE_GAME_ID && room.currentGame !== 'speed_todo') {
    throw new ApiError(400, 'This room is not a GameZone room');
  }

  return room;
}

async function findBattlePlayer(roomId, userId) {
  return GamePlayer.findOne({ roomId, userId });
}

async function requireBattlePlayer(room, userId) {
  const player = await findBattlePlayer(room._id, userId);

  if (!player) {
    throw new ApiError(403, 'Join the room before doing this');
  }

  player.connected = true;
  player.lastSeen = new Date();
  await player.save();
  return player;
}

async function requireBattleHost(room, userId) {
  const player = await requireBattlePlayer(room, userId);

  if (!player.isHost) {
    throw new ApiError(403, 'Only the host can do this');
  }

  return player;
}

async function syncBattleStatus(room) {
  if (room.status === 'playing' && room.roundEndsAt && room.roundEndsAt <= new Date()) {
    room.status = 'voting';
    await room.save();
  }

  return room;
}

function serializeBattleRoom(room) {
  return {
    id: toId(room._id),
    code: room.code,
    name: room.name,
    hostUserId: toId(room.hostUserId),
    groupId: toId(room.groupId),
    status: room.status,
    currentGame: room.currentGame,
    theme: room.theme,
    roundEndsAt: room.roundEndsAt,
    settings: room.settings,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function serializeBattlePlayer(player) {
  return {
    id: toId(player._id),
    roomId: toId(player.roomId),
    userId: toId(player.userId),
    nickname: player.nickname,
    avatar: player.avatar,
    score: player.score || 0,
    isHost: Boolean(player.isHost),
    isReady: Boolean(player.isReady),
    connected: Boolean(player.connected),
    lastSeen: player.lastSeen
  };
}

function serializeBattleSubmission(submission, playersByUserId, includeContent = true) {
  const player = playersByUserId.get(toId(submission.userId));

  return {
    id: toId(submission._id),
    roomId: toId(submission.roomId),
    userId: toId(submission.userId),
    nickname: player?.nickname || 'Player',
    avatar: player?.avatar || '',
    content: includeContent ? submission.content : '',
    createdAt: submission.createdAt
  };
}

function buildBattleResults(room, players, submissions, votes) {
  const scores = new Map(players.map((player) => [
    toId(player.userId),
    {
      userId: toId(player.userId),
      nickname: player.nickname,
      avatar: player.avatar,
      score: 0,
      breakdown: []
    }
  ]));

  submissions.forEach((submission) => {
    const score = scores.get(toId(submission.userId));

    if (score) {
      score.score += 1;
      score.breakdown.push('+1 reponse valide');
    }
  });

  Object.keys(BATTLE_CATEGORY_POINTS).forEach((category) => {
    const counts = new Map();

    votes
      .filter((vote) => vote.category === category)
      .forEach((vote) => {
        const key = toId(vote.submissionId);
        counts.set(key, (counts.get(key) || 0) + 1);
      });

    if (!counts.size) {
      return;
    }

    const best = Math.max(...counts.values());

    counts.forEach((count, submissionId) => {
      if (count !== best) {
        return;
      }

      const submission = submissions.find((item) => toId(item._id) === submissionId);
      const score = submission ? scores.get(toId(submission.userId)) : null;

      if (score) {
        const points = BATTLE_CATEGORY_POINTS[category];
        score.score += points;
        score.breakdown.push(`+${points} ${category}`);
      }
    });
  });

  const ranking = [...scores.values()].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  const winner = ranking[0] || null;
  const funnyWinnerSubmission = submissions.find((submission) => {
    const bestFunnyVotes = votes.filter((vote) => vote.category === 'funny');

    if (!bestFunnyVotes.length) {
      return false;
    }

    const counts = bestFunnyVotes.reduce((map, vote) => {
      const key = toId(vote.submissionId);
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());
    const max = Math.max(...counts.values());
    return counts.get(toId(submission._id)) === max;
  });

  return {
    roomCode: room.code,
    status: room.status,
    ranking,
    winner,
    badge: funnyWinnerSubmission ? 'Badge drole attribue' : 'Badge participation creative',
    funnySubmissionId: funnyWinnerSubmission ? toId(funnyWinnerSubmission._id) : ''
  };
}

async function buildBattleState(room, userId) {
  await syncBattleStatus(room);

  const [players, submissions, votes, currentPlayer] = await Promise.all([
    GamePlayer.find({ roomId: room._id }).sort({ isHost: -1, score: -1, createdAt: 1 }).lean(),
    GameSubmission.find({ roomId: room._id }).sort({ createdAt: 1 }).lean(),
    GameVote.find({ roomId: room._id }).sort({ createdAt: 1 }).lean(),
    GamePlayer.findOne({ roomId: room._id, userId }).lean()
  ]);
  const playersByUserId = new Map(players.map((player) => [toId(player.userId), player]));
  const shouldReveal = room.status === 'voting' || room.status === 'finished';
  const visibleSubmissions = submissions
    .filter((submission) => shouldReveal || toId(submission.userId) === toId(userId))
    .map((submission) => serializeBattleSubmission(submission, playersByUserId, shouldReveal || toId(submission.userId) === toId(userId)));

  return {
    room: serializeBattleRoom(room),
    players: players.map(serializeBattlePlayer),
    currentPlayer: currentPlayer ? serializeBattlePlayer(currentPlayer) : null,
    submissions: visibleSubmissions,
    votes: votes.map((vote) => ({
      id: toId(vote._id),
      voterId: toId(vote.voterId),
      submissionId: toId(vote.submissionId),
      category: vote.category,
      createdAt: vote.createdAt
    })),
    results: room.status === 'finished' ? buildBattleResults(room, players, submissions, votes) : null
  };
}

async function createBattleRoom(userId, body = {}) {
  const user = await getBattleUser(userId);
  await assertGroupAccess(body.groupId, userId);

  const code = await ensureBattleCode();
  const theme = normalizeBattleTheme(body.theme);
  const nickname = normalizeBattleNickname(body.nickname, userFallbackName(user));
  const room = await GameRoom.create({
    code,
    name: normalizeText(body.name || 'Speed Tasks Battle').slice(0, 80),
    hostUserId: userId,
    groupId: body.groupId || null,
    status: 'lobby',
    currentGame: BATTLE_GAME_ID,
    theme,
    roundEndsAt: null,
    settings: {
      maxPlayers: 12,
      roundDuration: 60,
      enableChat: false,
      allowAnonymousPlayers: false,
      familyFriendlyMode: true,
      chaosMode: false
    }
  });

  await GamePlayer.create({
    roomId: room._id,
    userId,
    nickname,
    avatar: normalizeText(body.avatar || nickname.charAt(0).toUpperCase()).slice(0, 120),
    score: 0,
    isHost: true,
    isReady: true,
    connected: true,
    lastSeen: new Date()
  });

  return buildBattleState(room, userId);
}

async function joinBattleRoom(userId, body = {}) {
  const user = await getBattleUser(userId);
  const room = await findBattleRoom(body.code);
  await assertGroupAccess(room.groupId, userId);

  if (room.status !== 'lobby') {
    throw new ApiError(409, 'This room has already started');
  }

  const nickname = normalizeBattleNickname(body.nickname, userFallbackName(user));
  const existing = await findBattlePlayer(room._id, userId);

  if (existing) {
    existing.nickname = nickname;
    existing.avatar = normalizeText(body.avatar || existing.avatar || nickname.charAt(0).toUpperCase()).slice(0, 120);
    existing.connected = true;
    existing.lastSeen = new Date();
    await existing.save();
    return buildBattleState(room, userId);
  }

  const playerCount = await GamePlayer.countDocuments({ roomId: room._id, connected: true });

  if (playerCount >= 12) {
    throw new ApiError(409, 'Room is full');
  }

  await GamePlayer.create({
    roomId: room._id,
    userId,
    nickname,
    avatar: normalizeText(body.avatar || nickname.charAt(0).toUpperCase()).slice(0, 120),
    score: 0,
    isHost: false,
    isReady: false,
    connected: true,
    lastSeen: new Date()
  });

  return buildBattleState(room, userId);
}

async function getBattleRoom(userId, code) {
  const room = await findBattleRoom(code);
  await assertGroupAccess(room.groupId, userId);
  await requireBattlePlayer(room, userId);
  return buildBattleState(room, userId);
}

async function setBattleReady(userId, code, isReady) {
  const room = await findBattleRoom(code);
  const player = await requireBattlePlayer(room, userId);

  if (room.status !== 'lobby') {
    throw new ApiError(409, 'Ready state can only change in lobby');
  }

  player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;
  player.lastSeen = new Date();
  await player.save();
  return buildBattleState(room, userId);
}

async function startBattleRoom(userId, code) {
  const room = await findBattleRoom(code);
  await requireBattleHost(room, userId);

  if (room.status !== 'lobby') {
    throw new ApiError(409, 'Room is not in lobby');
  }

  const playerCount = await GamePlayer.countDocuments({ roomId: room._id, connected: true });

  if (playerCount < 1) {
    throw new ApiError(409, 'At least one player is required');
  }

  await Promise.all([
    GameSubmission.deleteMany({ roomId: room._id }),
    GameVote.deleteMany({ roomId: room._id }),
    GamePlayer.updateMany({ roomId: room._id }, { $set: { score: 0 } })
  ]);

  room.status = 'playing';
  room.currentGame = BATTLE_GAME_ID;
  room.roundEndsAt = new Date(Date.now() + 60 * 1000);
  await room.save();
  return buildBattleState(room, userId);
}

async function submitBattleResponse(userId, code, body = {}) {
  const room = await findBattleRoom(code);
  await syncBattleStatus(room);
  await requireBattlePlayer(room, userId);

  if (room.status !== 'playing') {
    throw new ApiError(409, 'Submissions are closed');
  }

  const content = normalizeText(body.content || body.text).slice(0, 140);
  const error = validateSafeText('Submission', content, { min: 1, max: 140 });

  if (error) {
    throw new ApiError(400, error);
  }

  const count = await GameSubmission.countDocuments({ roomId: room._id, userId });

  if (count >= 20) {
    throw new ApiError(429, 'Submission limit reached for this round');
  }

  const submission = await GameSubmission.create({
    roomId: room._id,
    userId,
    content
  });

  return submission;
}

async function listBattleSubmissions(userId, code) {
  const room = await findBattleRoom(code);
  await requireBattlePlayer(room, userId);
  const state = await buildBattleState(room, userId);
  return state.submissions;
}

async function voteBattleSubmission(userId, code, body = {}) {
  const room = await findBattleRoom(code);
  await syncBattleStatus(room);
  await requireBattlePlayer(room, userId);

  if (room.status !== 'voting') {
    throw new ApiError(409, 'Votes are not open');
  }

  const category = normalizeText(body.category).toLowerCase();

  if (!BATTLE_CATEGORIES.has(category)) {
    throw new ApiError(400, 'Vote category is invalid');
  }

  if (!validateObjectId(body.submissionId)) {
    throw new ApiError(400, 'Submission id is invalid');
  }

  const submission = await GameSubmission.findOne({ _id: body.submissionId, roomId: room._id });

  if (!submission) {
    throw new ApiError(404, 'Submission not found');
  }

  if (toId(submission.userId) === toId(userId)) {
    throw new ApiError(400, 'Self votes are not allowed');
  }

  await GameVote.findOneAndUpdate(
    { roomId: room._id, voterId: userId, category },
    { $set: { submissionId: submission._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return buildBattleState(room, userId);
}

async function finishBattleRoom(userId, code) {
  const room = await findBattleRoom(code);
  await syncBattleStatus(room);
  await requireBattleHost(room, userId);

  if (room.status !== 'voting' && room.status !== 'playing') {
    throw new ApiError(409, 'Room cannot be finished now');
  }

  room.status = 'finished';
  await room.save();

  const [players, submissions, votes] = await Promise.all([
    GamePlayer.find({ roomId: room._id }),
    GameSubmission.find({ roomId: room._id }).lean(),
    GameVote.find({ roomId: room._id }).lean()
  ]);
  const results = buildBattleResults(room, players, submissions, votes);

  await Promise.all(players.map((player) => {
    const score = results.ranking.find((item) => item.userId === toId(player.userId));
    player.score = score?.score || 0;
    return player.save();
  }));

  return buildBattleState(room, userId);
}

async function getBattleResults(userId, code) {
  const room = await findBattleRoom(code);
  await requireBattlePlayer(room, userId);
  const [players, submissions, votes] = await Promise.all([
    GamePlayer.find({ roomId: room._id }).lean(),
    GameSubmission.find({ roomId: room._id }).lean(),
    GameVote.find({ roomId: room._id }).lean()
  ]);

  return buildBattleResults(room, players, submissions, votes);
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
