const express = require('express');

const auth = require('../middleware/auth');
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  getStats,
  exportTasks,
  getAssistant,
  getAnalysis
} = require('../controllers/taskController');

const router = express.Router();

router.use(auth);

router.get('/', getTasks);
router.get('/stats', getStats);
router.get('/export', exportTasks);
router.post('/reorder', reorderTasks);
router.post('/ai/assistant', getAssistant);
router.get('/ai/analysis', getAnalysis);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
