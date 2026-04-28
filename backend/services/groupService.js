const ChatMessage = require('../models/ChatMessage');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateRoomCode, normalizeRoomCode } = require('../utils/roomCode');
const {
  normalizeEmail,
  normalizeText,
  normalizeUrl,
  validateObjectId,
  validateSafeText
} = require('../utils/validators');
const chatService = require('./chatService');

const ADMIN_ROLES = new Set(['owner', 'admin']);

function toId(value) {
  return value ? String(value) : '';
}

function normalizeGroupPayload(body = {}, isCreate = false) {
  const payload = {};

  if (isCreate || Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = normalizeText(body.name).slice(0, 80);
    const error = validateSafeText('Group name', name, { min: 2, max: 80 });

    if (error) {
      throw new ApiError(400, error);
    }

    payload.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = normalizeText(body.description).slice(0, 240);
    const error = validateSafeText('Group description', description, { max: 240 });

    if (error) {
      throw new ApiError(400, error);
    }

    payload.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
    const avatarUrl = normalizeUrl(body.avatarUrl, { max: 500 });

    if (body.avatarUrl && !avatarUrl) {
      throw new ApiError(400, 'Group avatar URL must be a valid http/https URL');
    }

    payload.avatarUrl = avatarUrl;
  }

  return payload;
}

async function ensureUniqueInviteCode() {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const code = generateRoomCode(8);
    const exists = await Group.exists({ inviteCode: code });

    if (!exists) {
      return code;
    }
  }

  throw new ApiError(500, 'Unable to generate invite code');
}

async function requireGroup(groupId) {
  if (!validateObjectId(groupId)) {
    throw new ApiError(400, 'Group id is invalid');
  }

  const group = await Group.findById(groupId);

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  return group;
}

async function getMembership(groupId, userId) {
  if (!validateObjectId(groupId) || !validateObjectId(userId)) {
    return null;
  }

  return GroupMember.findOne({ groupId, userId });
}

async function requireGroupMember(groupId, userId) {
  const [group, membership] = await Promise.all([
    requireGroup(groupId),
    getMembership(groupId, userId)
  ]);

  if (!membership) {
    throw new ApiError(403, 'You must be a group member');
  }

  return { group, membership };
}

async function requireGroupAdmin(groupId, userId) {
  const context = await requireGroupMember(groupId, userId);

  if (!ADMIN_ROLES.has(context.membership.role)) {
    throw new ApiError(403, 'Only group admins can do this');
  }

  return context;
}

async function requireGroupOwner(groupId, userId) {
  const context = await requireGroupMember(groupId, userId);

  if (context.membership.role !== 'owner') {
    throw new ApiError(403, 'Only the group owner can do this');
  }

  return context;
}

function serializeGroup(group, membership) {
  return {
    id: toId(group._id),
    name: group.name,
    description: group.description,
    avatarUrl: group.avatarUrl,
    ownerId: toId(group.ownerId),
    inviteCode: group.inviteCode,
    role: membership?.role || '',
    settings: group.settings,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

async function createGroup(userId, body) {
  const payload = normalizeGroupPayload(body, true);
  const inviteCode = await ensureUniqueInviteCode();
  const group = await Group.create({
    ...payload,
    ownerId: userId,
    inviteCode
  });

  const membership = await GroupMember.create({
    groupId: group._id,
    userId,
    role: 'owner',
    nickname: normalizeText(body.nickname || '').slice(0, 40)
  });

  return serializeGroup(group, membership);
}

async function listGroups(userId) {
  const memberships = await GroupMember.find({ userId }).lean();
  const groupIds = memberships.map((membership) => membership.groupId);
  const groups = await Group.find({ _id: { $in: groupIds } }).sort({ updatedAt: -1 }).lean();
  const membershipByGroup = new Map(memberships.map((membership) => [toId(membership.groupId), membership]));

  return groups.map((group) => serializeGroup(group, membershipByGroup.get(toId(group._id))));
}

async function getGroup(userId, groupId) {
  const { group, membership } = await requireGroupMember(groupId, userId);
  return serializeGroup(group, membership);
}

async function updateGroup(userId, groupId, body) {
  const { group, membership } = await requireGroupAdmin(groupId, userId);
  const payload = normalizeGroupPayload(body, false);

  if (!Object.keys(payload).length) {
    throw new ApiError(400, 'No valid group fields provided');
  }

  Object.assign(group, payload);
  await group.save();
  return serializeGroup(group, membership);
}

async function deleteGroup(userId, groupId) {
  const { group } = await requireGroupOwner(groupId, userId);

  await Promise.all([
    GroupMember.deleteMany({ groupId: group._id }),
    ChatMessage.deleteMany({ groupId: group._id }),
    Group.deleteOne({ _id: group._id })
  ]);

  return { message: 'Group deleted' };
}

async function inviteUser(userId, groupId, body = {}) {
  const { group } = await requireGroupAdmin(groupId, userId);
  const email = normalizeEmail(body.email);

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const invitedUser = await User.findOne({ email });

  if (invitedUser) {
    await GroupMember.updateOne(
      { groupId: group._id, userId: invitedUser._id },
      { $setOnInsert: { role: 'member', joinedAt: new Date() } },
      { upsert: true }
    );
  }

  return {
    message: 'Invitation ready',
    inviteCode: group.inviteCode
  };
}

async function joinGroup(userId, body = {}) {
  const inviteCode = normalizeRoomCode(body.inviteCode || body.code);

  if (!/^[A-Z0-9]{6,12}$/.test(inviteCode)) {
    throw new ApiError(400, 'Invite code is invalid');
  }

  const group = await Group.findOne({ inviteCode });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const membership = await GroupMember.findOneAndUpdate(
    { groupId: group._id, userId },
    {
      $setOnInsert: {
        role: 'member',
        joinedAt: new Date()
      },
      $set: {
        nickname: normalizeText(body.nickname || '').slice(0, 40)
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return serializeGroup(group, membership);
}

async function listMembers(userId, groupId) {
  await requireGroupMember(groupId, userId);
  const members = await GroupMember.find({ groupId })
    .populate('userId', 'email')
    .sort({ role: 1, joinedAt: 1 })
    .lean();

  return members.map((member) => ({
    id: toId(member._id),
    groupId: toId(member.groupId),
    userId: toId(member.userId?._id || member.userId),
    email: member.userId?.email || '',
    role: member.role,
    nickname: member.nickname,
    joinedAt: member.joinedAt
  }));
}

async function updateMember(userId, groupId, targetUserId, body = {}) {
  await requireGroupOwner(groupId, userId);

  if (!validateObjectId(targetUserId)) {
    throw new ApiError(400, 'User id is invalid');
  }

  const role = normalizeText(body.role).toLowerCase();

  if (!['admin', 'member'].includes(role)) {
    throw new ApiError(400, 'Role is invalid');
  }

  const member = await GroupMember.findOneAndUpdate(
    { groupId, userId: targetUserId, role: { $ne: 'owner' } },
    { $set: { role } },
    { new: true }
  );

  if (!member) {
    throw new ApiError(404, 'Group member not found');
  }

  return member;
}

async function removeMember(userId, groupId, targetUserId) {
  const { membership } = await requireGroupMember(groupId, userId);

  if (!validateObjectId(targetUserId)) {
    throw new ApiError(400, 'User id is invalid');
  }

  const isSelf = toId(userId) === toId(targetUserId);

  if (!isSelf && !ADMIN_ROLES.has(membership.role)) {
    throw new ApiError(403, 'Only group admins can remove members');
  }

  const target = await GroupMember.findOne({ groupId, userId: targetUserId });

  if (!target) {
    throw new ApiError(404, 'Group member not found');
  }

  if (target.role === 'owner') {
    throw new ApiError(400, 'The owner must delete the group instead');
  }

  await GroupMember.deleteOne({ _id: target._id });
  return { message: isSelf ? 'Left group' : 'Member removed' };
}

async function listGroupMessages(userId, groupId) {
  await requireGroupMember(groupId, userId);
  return chatService.listMessages(userId, { groupId });
}

async function createGroupMessage(userId, groupId, body) {
  await requireGroupMember(groupId, userId);
  return chatService.createMessage(userId, body, { groupId });
}

module.exports = {
  createGroup,
  createGroupMessage,
  deleteGroup,
  getGroup,
  getMembership,
  inviteUser,
  joinGroup,
  listGroupMessages,
  listGroups,
  listMembers,
  removeMember,
  requireGroupMember,
  updateGroup,
  updateMember
};
