const express = require('express');

const {
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
} = require('../controllers/groupController');
const auth = require('../middleware/auth');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const groupWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyPrefix: 'groups'
});
const groupMessageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 35,
  keyPrefix: 'group-messages'
});

router.use(auth);

router.post('/', groupWriteLimiter, createGroup);
router.get('/', listGroups);
router.post('/join', groupWriteLimiter, joinGroup);
router.get('/:id', getGroup);
router.patch('/:id', groupWriteLimiter, updateGroup);
router.delete('/:id', groupWriteLimiter, deleteGroup);
router.post('/:id/invite', groupWriteLimiter, inviteUser);
router.get('/:id/members', listMembers);
router.patch('/:id/members/:userId', groupWriteLimiter, updateMember);
router.delete('/:id/members/:userId', groupWriteLimiter, removeMember);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', groupMessageLimiter, createMessage);

module.exports = router;
