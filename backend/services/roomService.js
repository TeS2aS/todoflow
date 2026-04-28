const mongoose = require('mongoose');

const GameHistory = require('../models/GameHistory');
const GameRoom = require('../models/GameRoom');
const GameSession = require('../models/GameSession');
const Player = require('../models/Player');
const RoomMessage = require('../models/RoomMessage');
const ApiError = require('../utils/apiError');
const { AVATAR_OPTIONS } = require('../utils/gameRules');
const { generateRoomCode, normalizeRoomCode } = require('../utils/roomCode');
const {
  normalizeText,
  validateObjectId,
  validateSafeText
} = require('../utils/validators');

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  roundDuration: 60,
  allowAnonymousPlayers: true,
  enableChat: true,
  familyFriendlyMode: true,
  chaosMode: false
};

function toId(value) {
  return value ? String(value) : '';
}

function validateBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettings(settings = {}) {
  const maxPlayers = normalizeInteger(settings.maxPlayers, DEFAULT_SETTINGS.maxPlayers);
  const roundDuration = normalizeInteger(settings.roundDuration, DEFAULT_SETTINGS.roundDuration);

  if (maxPlayers < 2 || maxPlayers > 12) {
    throw new ApiError(400, 'Room maxPlayers must be between 2 and 12');
  }

  if (![30, 60, 90].includes(roundDuration)) {
    throw new ApiError(400, 'Round duration must be 30, 60 or 90 seconds');
  }

  return {
    maxPlayers,
    roundDuration,
    allowAnonymousPlayers: validateBoolean(settings.allowAnonymousPlayers, DEFAULT_SETTINGS.allowAnonymousPlayers),
    enableChat: validateBoolean(settings.enableChat, DEFAULT_SETTINGS.enableChat),
    familyFriendlyMode: true,
    chaosMode: validateBoolean(settings.chaosMode, DEFAULT_SETTINGS.chaosMode)
  };
}

function normalizeNickname(value) {
  const nickname = normalizeText(value).slice(0, 32);
  const error = validateSafeText('Nickname', nickname, { min: 2, max: 32 });

  if (error) {
    throw new ApiError(400, error);
  }

  return nickname;
}

function normalizeRoomName(value) {
  const name = normalizeText(value).slice(0, 80);
  const error = validateSafeText('Room name', name, { min: 2, max: 80 });

  if (error) {
    throw new ApiError(400, error);
  }

  return name;
}

function normalizeAvatar(value) {
  const avatar = String(value || '').trim();

  if (AVATAR_OPTIONS.includes(avatar)) {
    return avatar;
  }

  return AVATAR_OPTIONS[0];
}

function assertValidUserId(userId) {
  if (!validateObjectId(userId)) {
    throw new ApiError(401, 'Authentication token is invalid');
  }
}

function serializePlayer(player) {
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

function serializeSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: toId(session._id),
    roomId: toId(session.roomId),
    gameType: session.gameType,
    status: session.status,
    round: session.round,
    prompts: session.prompts || [],
    submissions: (session.submissions || []).map((submission) => ({
      id: toId(submission._id),
      playerId: toId(submission.playerId),
      nickname: submission.nickname,
      avatar: submission.avatar,
      items: submission.items || [],
      submittedAt: submission.submittedAt
    })),
    votes: (session.votes || []).map((vote) => ({
      playerId: toId(vote.playerId),
      category: vote.category,
      submissionId: toId(vote.submissionId),
      itemIndex: vote.itemIndex,
      targetPlayerId: toId(vote.targetPlayerId),
      createdAt: vote.createdAt
    })),
    scores: session.scores || [],
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function serializeRoom(room) {
  return {
    id: toId(room._id),
    code: room.code,
    name: room.name,
    hostUserId: toId(room.hostUserId),
    status: room.status,
    currentGame: room.currentGame,
    currentRound: room.currentRound,
    settings: room.settings,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function serializeMessage(message) {
  return {
    id: toId(message._id),
    roomId: toId(message.roomId),
    playerId: toId(message.playerId),
    message: message.message,
    type: message.type,
    createdAt: message.createdAt
  };
}

function serializeHistory(history) {
  return {
    id: toId(history._id),
    roomId: toId(history.roomId),
    winners: history.winners || [],
    finalScores: history.finalScores || [],
    funnySummary: history.funnySummary,
    createdAt: history.createdAt
  };
}

async function addSystemMessage(roomId, message, type = 'system') {
  const safeMessage = normalizeText(message).slice(0, 240);

  if (!safeMessage) {
    return null;
  }

  return RoomMessage.create({
    roomId,
    message: safeMessage,
    type
  });
}

async function findRoomByCode(code) {
  const normalizedCode = normalizeRoomCode(code);

  if (!ROOM_CODE_PATTERN.test(normalizedCode)) {
    throw new ApiError(400, 'Room code is invalid');
  }

  const room = await GameRoom.findOne({ code: normalizedCode });

  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  return room;
}

async function findCurrentPlayer(roomId, userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return Player.findOne({ roomId, userId });
}

async function requireRoomPlayer(room, userId) {
  const player = await findCurrentPlayer(room._id, userId);

  if (!player) {
    throw new ApiError(403, 'Join the room before doing this');
  }

  if (!player.connected) {
    player.connected = true;
    player.lastSeen = new Date();
    await player.save();
  }

  return player;
}

async function requireRoomHost(room, userId) {
  const player = await requireRoomPlayer(room, userId);

  if (!player.isHost) {
    throw new ApiError(403, 'Only the host can do this');
  }

  return player;
}

async function ensureUniqueCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateRoomCode();
    const existing = await GameRoom.exists({ code });

    if (!existing) {
      return code;
    }
  }

  throw new ApiError(500, 'Unable to create a unique room code');
}

async function assertNicknameAvailable(roomId, nickname, userId) {
  const duplicate = await Player.findOne({
    roomId,
    nickname,
    connected: true,
    ...(userId ? { userId: { $ne: userId } } : {})
  });

  if (duplicate) {
    throw new ApiError(409, 'Nickname is already used in this room');
  }
}

async function buildRoomState(room, userId) {
  const currentPlayerQuery = userId && mongoose.Types.ObjectId.isValid(userId)
    ? Player.findOne({ roomId: room._id, userId }).lean()
    : Promise.resolve(null);

  const [players, currentSession, messages, history, currentPlayer] = await Promise.all([
    Player.find({ roomId: room._id }).sort({ isHost: -1, score: -1, createdAt: 1 }).lean(),
    GameSession.findOne({ roomId: room._id }).sort({ createdAt: -1 }).lean(),
    RoomMessage.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(30).lean(),
    GameHistory.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(5).lean(),
    currentPlayerQuery
  ]);

  return {
    room: serializeRoom(room),
    players: players.map(serializePlayer),
    currentPlayerId: currentPlayer ? toId(currentPlayer._id) : '',
    currentPlayer: currentPlayer ? serializePlayer(currentPlayer) : null,
    session: serializeSession(currentSession),
    messages: messages.reverse().map(serializeMessage),
    history: history.map(serializeHistory)
  };
}

async function createRoom(userId, body) {
  assertValidUserId(userId);

  const name = normalizeRoomName(body.name || 'Soiree PartyFlow');
  const nickname = normalizeNickname(body.nickname || 'Capitaine Chaos');
  const avatar = normalizeAvatar(body.avatar);
  const settings = normalizeSettings(body.settings || {});
  const code = await ensureUniqueCode();

  const room = await GameRoom.create({
    code,
    name,
    hostUserId: userId,
    status: 'lobby',
    settings
  });

  await Player.create({
    roomId: room._id,
    userId,
    nickname,
    avatar,
    score: 0,
    isHost: true,
    isReady: true,
    connected: true,
    lastSeen: new Date()
  });

  await addSystemMessage(room._id, `${nickname} a cree la salle. Le chaos est en cours de chargement...`);

  return buildRoomState(room, userId);
}

async function joinRoom(userId, body) {
  assertValidUserId(userId);

  const room = await findRoomByCode(body.code);

  if (room.status !== 'lobby') {
    throw new ApiError(409, 'This room is already playing');
  }

  const nickname = normalizeNickname(body.nickname || 'Invite mystere');
  const avatar = normalizeAvatar(body.avatar);
  const existingPlayer = await findCurrentPlayer(room._id, userId);

  await assertNicknameAvailable(room._id, nickname, userId);

  if (existingPlayer) {
    existingPlayer.nickname = nickname;
    existingPlayer.avatar = avatar;
    existingPlayer.connected = true;
    existingPlayer.lastSeen = new Date();
    await existingPlayer.save();
    await addSystemMessage(room._id, `${nickname} est revenu dans la salle.`);
    return buildRoomState(room, userId);
  }

  const connectedCount = await Player.countDocuments({ roomId: room._id, connected: true });

  if (connectedCount >= room.settings.maxPlayers) {
    throw new ApiError(409, 'Room is full');
  }

  await Player.create({
    roomId: room._id,
    userId,
    nickname,
    avatar,
    score: 0,
    isHost: false,
    isReady: false,
    connected: true,
    lastSeen: new Date()
  });

  await addSystemMessage(room._id, `${nickname} a rejoint. Quelqu un va regretter ce vote.`);

  return buildRoomState(room, userId);
}

async function getRoomState(userId, code) {
  const room = await findRoomByCode(code);
  const player = await requireRoomPlayer(room, userId);

  player.lastSeen = new Date();
  await player.save();

  return buildRoomState(room, userId);
}

async function leaveRoom(userId, code) {
  const room = await findRoomByCode(code);
  const player = await requireRoomPlayer(room, userId);

  player.connected = false;
  player.isReady = false;
  player.lastSeen = new Date();

  if (player.isHost) {
    player.isHost = false;
    await player.save();

    const nextHost = await Player.findOne({
      roomId: room._id,
      connected: true,
      _id: { $ne: player._id }
    }).sort({ score: -1, createdAt: 1 });

    if (nextHost) {
      nextHost.isHost = true;
      nextHost.isReady = true;
      await nextHost.save();
      room.hostUserId = nextHost.userId || room.hostUserId;
      await room.save();
      await addSystemMessage(room._id, `${nextHost.nickname} devient hote. Le classement est injuste, mais officiel.`);
    } else {
      room.status = 'finished';
      await room.save();
    }
  } else {
    await player.save();
  }

  await addSystemMessage(room._id, `${player.nickname} a quitte la salle.`);

  return { message: 'Player left room' };
}

async function setReady(userId, code, isReady) {
  const room = await findRoomByCode(code);
  const player = await requireRoomPlayer(room, userId);

  player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;
  player.lastSeen = new Date();
  await player.save();

  await addSystemMessage(room._id, `${player.nickname} est ${player.isReady ? 'pret' : 'pas pret'}.`);

  return buildRoomState(room, userId);
}

async function getScores(userId, code) {
  const room = await findRoomByCode(code);
  await requireRoomPlayer(room, userId);

  const players = await Player.find({ roomId: room._id })
    .sort({ score: -1, updatedAt: 1 })
    .lean();

  return players.map(serializePlayer);
}

async function getHistory(userId, code) {
  const room = await findRoomByCode(code);
  await requireRoomPlayer(room, userId);

  const history = await GameHistory.find({ roomId: room._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  return history.map(serializeHistory);
}

async function getMessages(userId, code) {
  const room = await findRoomByCode(code);
  await requireRoomPlayer(room, userId);

  if (!room.settings.enableChat) {
    return [];
  }

  const messages = await RoomMessage.find({ roomId: room._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return messages.reverse().map(serializeMessage);
}

async function createMessage(userId, code, body) {
  const room = await findRoomByCode(code);
  const player = await requireRoomPlayer(room, userId);

  if (!room.settings.enableChat) {
    throw new ApiError(403, 'Chat is disabled in this room');
  }

  const message = normalizeText(body.message).slice(0, 240);
  const error = validateSafeText('Message', message, { min: 1, max: 240 });

  if (error) {
    throw new ApiError(400, error);
  }

  await RoomMessage.create({
    roomId: room._id,
    playerId: player._id,
    message,
    type: 'user'
  });

  return getMessages(userId, code);
}

module.exports = {
  addSystemMessage,
  buildRoomState,
  createMessage,
  createRoom,
  findRoomByCode,
  getHistory,
  getMessages,
  getRoomState,
  getScores,
  joinRoom,
  leaveRoom,
  normalizeAvatar,
  normalizeNickname,
  normalizeSettings,
  requireRoomHost,
  requireRoomPlayer,
  setReady
};
