const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Subtask title is required'],
      trim: true,
      maxlength: 120
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const historySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'completed', 'reopened', 'reordered'],
      required: true
    },
    field: {
      type: String,
      maxlength: 80
    },
    from: {
      type: mongoose.Schema.Types.Mixed
    },
    to: {
      type: mongoose.Schema.Types.Mixed
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 1,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600,
      default: ''
    },
    completed: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    category: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
      index: true
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(tags) {
          return tags.length <= 12 && tags.every((tag) => tag.length <= 32);
        },
        message: 'Tags are invalid'
      }
    },
    subtasks: {
      type: [subtaskSchema],
      default: []
    },
    history: {
      type: [historySchema],
      default: []
    },
    position: {
      type: Number,
      default: () => Date.now(),
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

taskSchema.index({ userId: 1, completed: 1, position: 1 });
taskSchema.index({ userId: 1, priority: 1, dueDate: 1 });
taskSchema.index({ userId: 1, updatedAt: -1 });
taskSchema.index({ title: 'text', description: 'text', category: 'text', tags: 'text' });

module.exports = mongoose.model('Task', taskSchema);
