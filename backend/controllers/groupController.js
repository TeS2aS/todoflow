const groupService = require('../services/groupService');

async function createGroup(req, res, next) {
  try {
    const group = await groupService.createGroup(req.userId, req.body);
    return res.status(201).json(group);
  } catch (error) {
    return next(error);
  }
}

async function listGroups(req, res, next) {
  try {
    const groups = await groupService.listGroups(req.userId);
    return res.json(groups);
  } catch (error) {
    return next(error);
  }
}

async function getGroup(req, res, next) {
  try {
    const group = await groupService.getGroup(req.userId, req.params.id);
    return res.json(group);
  } catch (error) {
    return next(error);
  }
}

async function updateGroup(req, res, next) {
  try {
    const group = await groupService.updateGroup(req.userId, req.params.id, req.body);
    return res.json(group);
  } catch (error) {
    return next(error);
  }
}

async function deleteGroup(req, res, next) {
  try {
    const result = await groupService.deleteGroup(req.userId, req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function inviteUser(req, res, next) {
  try {
    const result = await groupService.inviteUser(req.userId, req.params.id, req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function joinGroup(req, res, next) {
  try {
    const group = await groupService.joinGroup(req.userId, req.body);
    return res.json(group);
  } catch (error) {
    return next(error);
  }
}

async function listMembers(req, res, next) {
  try {
    const members = await groupService.listMembers(req.userId, req.params.id);
    return res.json(members);
  } catch (error) {
    return next(error);
  }
}

async function updateMember(req, res, next) {
  try {
    const member = await groupService.updateMember(req.userId, req.params.id, req.params.userId, req.body);
    return res.json(member);
  } catch (error) {
    return next(error);
  }
}

async function removeMember(req, res, next) {
  try {
    const result = await groupService.removeMember(req.userId, req.params.id, req.params.userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listMessages(req, res, next) {
  try {
    const messages = await groupService.listGroupMessages(req.userId, req.params.id);
    return res.json(messages);
  } catch (error) {
    return next(error);
  }
}

async function createMessage(req, res, next) {
  try {
    const message = await groupService.createGroupMessage(req.userId, req.params.id, req.body);
    return res.status(201).json(message);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createGroup,
  createMessage,
  deleteGroup,
  getGroup,
  inviteUser,
  joinGroup,
  listGroups,
  listMembers,
  listMessages,
  removeMember,
  updateGroup,
  updateMember
};
