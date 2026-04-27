const Task = require('../models/Task');
const ApiError = require('../utils/apiError');
const {
  normalizeText,
  parseDateOrNull,
  sanitizeTags,
  validateObjectId,
  validatePriority,
  validateSafeText
} = require('../utils/validators');

const allowedFilters = new Set(['all', 'completed', 'active']);
const allowedDueFilters = new Set(['all', 'overdue', 'today', 'upcoming', 'none']);
const allowedSorts = new Set(['position', 'createdAt', 'updatedAt', 'dueDate', 'priority']);
const priorityWeight = {
  high: 3,
  medium: 2,
  low: 1
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertTaskId(id) {
  if (!validateObjectId(id)) {
    throw new ApiError(400, 'Invalid task id');
  }
}

function normalizePage(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function buildTaskQuery(userId, queryParams) {
  const filter = String(queryParams.filter || 'all');
  const due = String(queryParams.due || 'all');
  const query = { userId };

  if (!allowedFilters.has(filter)) {
    throw new ApiError(400, 'Invalid filter');
  }

  if (!allowedDueFilters.has(due)) {
    throw new ApiError(400, 'Invalid due date filter');
  }

  if (filter === 'completed') {
    query.completed = true;
  }

  if (filter === 'active') {
    query.completed = false;
  }

  if (queryParams.priority) {
    const priority = String(queryParams.priority);

    if (!validatePriority(priority)) {
      throw new ApiError(400, 'Invalid priority');
    }

    query.priority = priority;
  }

  if (queryParams.tag) {
    query.tags = normalizeText(queryParams.tag, 32).toLowerCase();
  }

  if (queryParams.search) {
    const search = normalizeText(queryParams.search);

    if (search.length > 80) {
      throw new ApiError(400, 'Search must contain 80 characters or less');
    }

    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { category: { $regex: safeSearch, $options: 'i' } },
        { tags: { $regex: safeSearch, $options: 'i' } }
      ];
    }
  }

  const { start, end } = todayBounds();

  if (due === 'overdue') {
    query.dueDate = { $lt: start };
    query.completed = false;
  }

  if (due === 'today') {
    query.dueDate = { $gte: start, $lt: end };
  }

  if (due === 'upcoming') {
    query.dueDate = { $gte: end };
  }

  if (due === 'none') {
    query.dueDate = null;
  }

  const dateFrom = parseDateOrNull(queryParams.dateFrom);
  const dateTo = parseDateOrNull(queryParams.dateTo);

  if (dateFrom === undefined || dateTo === undefined) {
    throw new ApiError(400, 'Invalid date filter');
  }

  if (dateFrom || dateTo) {
    query.dueDate = {
      ...(typeof query.dueDate === 'object' && query.dueDate !== null ? query.dueDate : {}),
      ...(dateFrom ? { $gte: dateFrom } : {}),
      ...(dateTo ? { $lte: dateTo } : {})
    };
  }

  return query;
}

function buildSort(sortParam) {
  const sort = String(sortParam || 'position');
  const isDescending = sort.startsWith('-');
  const field = isDescending ? sort.slice(1) : sort;

  if (!allowedSorts.has(field)) {
    throw new ApiError(400, 'Invalid sort');
  }

  if (field === 'priority') {
    return { priority: isDescending ? -1 : 1, dueDate: 1, position: 1 };
  }

  return { [field]: isDescending ? -1 : 1, createdAt: -1 };
}

async function listTasks(userId, queryParams) {
  const page = normalizePage(queryParams.page, 1, 1000);
  const limit = normalizePage(queryParams.limit, 20, 100);
  const skip = (page - 1) * limit;
  const query = buildTaskQuery(userId, queryParams);
  const sort = buildSort(queryParams.sort);

  const [data, total] = await Promise.all([
    Task.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Task.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) {
    return [];
  }

  return subtasks.slice(0, 40).map((subtask) => {
    const title = normalizeText(subtask.title, 120);
    const titleError = validateSafeText('Subtask title', title, { min: 1, max: 120 });

    if (titleError) {
      throw new ApiError(400, titleError);
    }

    return {
      _id: subtask._id,
      title,
      completed: Boolean(subtask.completed)
    };
  });
}

function buildTaskPayload(body, isCreate = false) {
  const payload = {};

  if (isCreate || Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = normalizeText(body.title, 120);
    const titleError = validateSafeText('Title', title, { min: 1, max: 120 });

    if (titleError) {
      throw new ApiError(400, titleError);
    }

    payload.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = normalizeText(body.description, 600);
    const descriptionError = validateSafeText('Description', description, { max: 600 });

    if (descriptionError) {
      throw new ApiError(400, descriptionError);
    }

    payload.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'completed')) {
    if (typeof body.completed !== 'boolean') {
      throw new ApiError(400, 'Completed must be a boolean');
    }

    payload.completed = body.completed;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    if (!validatePriority(body.priority)) {
      throw new ApiError(400, 'Invalid priority');
    }

    payload.priority = body.priority;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    const dueDate = parseDateOrNull(body.dueDate);

    if (dueDate === undefined) {
      throw new ApiError(400, 'Invalid due date');
    }

    payload.dueDate = dueDate;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    const category = normalizeText(body.category, 40);
    const categoryError = validateSafeText('Category', category, { max: 40 });

    if (categoryError) {
      throw new ApiError(400, categoryError);
    }

    payload.category = category;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
    if (!Array.isArray(body.tags) || body.tags.length > 12) {
      throw new ApiError(400, 'Tags must be an array with 12 items or less');
    }

    const invalidTag = body.tags
      .map((tag) => normalizeText(tag))
      .find((tag) => !tag || tag.length > 32 || validateSafeText('Tag', tag, { min: 1, max: 32 }));

    if (invalidTag) {
      throw new ApiError(400, 'Tags are invalid');
    }

    payload.tags = sanitizeTags(body.tags);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'subtasks')) {
    payload.subtasks = normalizeSubtasks(body.subtasks);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'position')) {
    const position = Number(body.position);

    if (!Number.isFinite(position)) {
      throw new ApiError(400, 'Position must be a number');
    }

    payload.position = position;
  }

  return payload;
}

function serializeForHistory(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function createHistoryEntries(task, payload) {
  return Object.keys(payload)
    .filter((field) => JSON.stringify(task[field]) !== JSON.stringify(payload[field]))
    .map((field) => {
      let action = 'updated';

      if (field === 'completed') {
        action = payload.completed ? 'completed' : 'reopened';
      }

      if (field === 'position') {
        action = 'reordered';
      }

      return {
        action,
        field,
        from: serializeForHistory(task[field]),
        to: serializeForHistory(payload[field]),
        changedAt: new Date()
      };
    });
}

async function createTask(userId, body) {
  const payload = buildTaskPayload(body, true);
  const task = await Task.create({
    ...payload,
    userId,
    position: Date.now(),
    history: [{ action: 'created', field: 'task', to: payload.title }]
  });

  return task;
}

async function updateTask(userId, id, body) {
  assertTaskId(id);

  const payload = buildTaskPayload(body, false);

  if (!Object.keys(payload).length) {
    throw new ApiError(400, 'No valid task fields provided');
  }

  const task = await Task.findOne({ _id: id, userId });

  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  const historyEntries = createHistoryEntries(task, payload);

  Object.assign(task, payload);

  if (historyEntries.length) {
    task.history = [...(task.history || []), ...historyEntries].slice(-50);
  }

  await task.save();
  return task;
}

async function deleteTask(userId, id) {
  assertTaskId(id);

  const task = await Task.findOneAndDelete({ _id: id, userId });

  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  return { message: 'Task deleted' };
}

async function reorderTasks(userId, orderedIds) {
  if (!Array.isArray(orderedIds) || !orderedIds.every(validateObjectId)) {
    throw new ApiError(400, 'Ordered task ids are required');
  }

  const operations = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, userId },
      update: {
        $set: { position: index + 1 },
        $push: {
          history: {
            $each: [{ action: 'reordered', field: 'position', to: index + 1 }],
            $slice: -50
          }
        }
      }
    }
  }));

  if (operations.length) {
    await Task.bulkWrite(operations);
  }

  return listTasks(userId, { sort: 'position', limit: orderedIds.length || 20 });
}

async function getStats(userId) {
  const now = new Date();
  const { start, end } = todayBounds();

  const [total, completed, overdue, dueToday, highPriority] = await Promise.all([
    Task.countDocuments({ userId }),
    Task.countDocuments({ userId, completed: true }),
    Task.countDocuments({ userId, completed: false, dueDate: { $lt: start } }),
    Task.countDocuments({ userId, dueDate: { $gte: start, $lt: end } }),
    Task.countDocuments({ userId, completed: false, priority: 'high' })
  ]);

  const completedToday = await Task.countDocuments({
    userId,
    completed: true,
    updatedAt: { $gte: start, $lte: now }
  });

  return {
    total,
    completed,
    active: total - completed,
    overdue,
    dueToday,
    highPriority,
    completedToday,
    productivity: total ? Math.round((completed / total) * 100) : 0
  };
}

async function exportTasks(userId) {
  const tasks = await Task.find({ userId }).sort({ position: 1, createdAt: -1 }).lean();

  return {
    exportedAt: new Date().toISOString(),
    count: tasks.length,
    tasks
  };
}

function scoreTask(task) {
  const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const urgency = dueTime === Number.MAX_SAFE_INTEGER
    ? 0
    : Math.max(0, 7 - Math.ceil((dueTime - Date.now()) / (24 * 60 * 60 * 1000)));

  return (priorityWeight[task.priority] || 1) * 10 + urgency + (task.subtasks || []).filter((item) => !item.completed).length;
}

module.exports = {
  exportTasks,
  getStats,
  listTasks,
  createTask,
  deleteTask,
  reorderTasks,
  scoreTask,
  updateTask
};
