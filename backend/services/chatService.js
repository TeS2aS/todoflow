const mongoose = require('mongoose');

const ChatMessage = require('../models/ChatMessage');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const {
  isLikelyImageUrl,
  normalizeText,
  normalizeUrl,
  validateObjectId,
  validateSafeText
} = require('../utils/validators');

const ALLOWED_TYPES = new Set(['text', 'image', 'gif']);
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/i;
const IMAGE_HOST_PATTERN = /(giphy\.com|media\.giphy\.com|tenor\.com|media\.tenor\.com)/i;

function toId(value) {
  return value ? String(value) : '';
}

function userNameFromEmail(email) {
  return String(email || 'user').split('@')[0].slice(0, 40) || 'user';
}

function avatarFromEmail(email) {
  const letter = userNameFromEmail(email).charAt(0).toUpperCase() || 'U';
  return letter;
}

async function getUserIdentity(userId) {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(401, 'Authentication token is invalid');
  }

  return {
    username: userNameFromEmail(user.email),
    avatar: avatarFromEmail(user.email)
  };
}

function extractFirstUrl(content) {
  const match = String(content || '').match(URL_PATTERN);

  if (!match) {
    return '';
  }

  return normalizeUrl(match[0]);
}

function buildLinkPreview(content) {
  const url = extractFirstUrl(content);

  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  return {
    url,
    title: parsed.hostname.replace(/^www\./, ''),
    siteName: parsed.hostname.replace(/^www\./, '')
  };
}

function assertMessageContent(type, content) {
  const error = validateSafeText('Message', content, { min: 1, max: type === 'text' ? 600 : 500 });

  if (error) {
    throw new ApiError(400, error);
  }

  if (type === 'image' && !isLikelyImageUrl(content)) {
    throw new ApiError(400, 'Image URL must be http/https and end with png, jpg, jpeg, webp or gif');
  }

  if (type === 'gif') {
    const url = normalizeUrl(content);

    if (!url || (!/\.gif(\?.*)?$/i.test(url) && !IMAGE_HOST_PATTERN.test(url))) {
      throw new ApiError(400, 'GIF URL must be a valid http/https GIF, Giphy or Tenor URL');
    }
  }
}

function normalizeMessagePayload(body = {}) {
  const type = normalizeText(body.type || 'text').toLowerCase();

  if (!ALLOWED_TYPES.has(type)) {
    throw new ApiError(400, 'Message type is invalid');
  }

  const rawContent = type === 'text' ? body.content : normalizeUrl(body.content);
  const content = normalizeText(rawContent).slice(0, type === 'text' ? 600 : 500);
  assertMessageContent(type, content);

  return {
    type,
    content,
    linkPreview: type === 'text' ? buildLinkPreview(content) : null
  };
}

function serializeMessage(message, userId) {
  const currentUserId = toId(userId);
  return {
    id: toId(message._id),
    userId: toId(message.userId),
    username: message.username,
    avatar: message.avatar,
    channelId: message.channelId,
    groupId: toId(message.groupId),
    type: message.deletedAt ? 'system' : message.type,
    content: message.deletedAt ? 'Message supprime' : message.content,
    linkPreview: message.deletedAt ? null : message.linkPreview,
    reactions: (message.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.userIds.length,
      reacted: reaction.userIds.some((id) => toId(id) === currentUserId)
    })),
    canDelete: toId(message.userId) === currentUserId && !message.deletedAt,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt
  };
}

async function listMessages(userId, options = {}) {
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 50, 1), 100);
  const query = options.groupId
    ? { groupId: options.groupId }
    : { channelId: 'general', groupId: null };

  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse().map((message) => serializeMessage(message, userId));
}

async function createMessage(userId, body, options = {}) {
  const identity = await getUserIdentity(userId);
  const payload = normalizeMessagePayload(body);

  const message = await ChatMessage.create({
    userId,
    username: identity.username,
    avatar: identity.avatar,
    channelId: options.groupId ? 'group' : 'general',
    groupId: options.groupId || null,
    ...payload
  });

  return serializeMessage(message, userId);
}

async function deleteMessage(userId, messageId) {
  if (!validateObjectId(messageId)) {
    throw new ApiError(400, 'Message id is invalid');
  }

  const message = await ChatMessage.findOne({
    _id: messageId,
    userId,
    deletedAt: null
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.groupId) {
    const membership = await GroupMember.exists({ groupId: message.groupId, userId });

    if (!membership) {
      throw new ApiError(403, 'You must be a group member');
    }
  }

  message.deletedAt = new Date();
  message.content = 'Message supprime';
  message.linkPreview = null;
  await message.save();

  return { message: 'Message deleted' };
}

async function toggleReaction(userId, messageId, emoji) {
  if (!validateObjectId(messageId)) {
    throw new ApiError(400, 'Message id is invalid');
  }

  const safeEmoji = String(emoji || '').trim().slice(0, 16);

  if (!safeEmoji || /<|>|javascript:|data:/i.test(safeEmoji)) {
    throw new ApiError(400, 'Reaction is invalid');
  }

  const message = await ChatMessage.findById(messageId);

  if (!message || message.deletedAt) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.groupId) {
    const membership = await GroupMember.exists({ groupId: message.groupId, userId });

    if (!membership) {
      throw new ApiError(403, 'You must be a group member');
    }
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const reaction = message.reactions.find((item) => item.emoji === safeEmoji);

  if (!reaction) {
    message.reactions.push({ emoji: safeEmoji, userIds: [userObjectId] });
  } else {
    const alreadyReacted = reaction.userIds.some((id) => toId(id) === toId(userId));
    reaction.userIds = alreadyReacted
      ? reaction.userIds.filter((id) => toId(id) !== toId(userId))
      : [...reaction.userIds, userObjectId];
  }

  message.reactions = message.reactions.filter((item) => item.userIds.length > 0);
  await message.save();

  return serializeMessage(message, userId);
}

module.exports = {
  createMessage,
  deleteMessage,
  listMessages,
  serializeMessage,
  toggleReaction
};
