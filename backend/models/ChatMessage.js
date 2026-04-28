const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16
    },
    userIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: []
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const linkPreviewSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
      maxlength: 500
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120
    },
    siteName: {
      type: String,
      trim: true,
      maxlength: 80
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },
    channelId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'general',
      index: true
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      index: true,
      default: null
    },
    type: {
      type: String,
      enum: ['text', 'image', 'gif', 'system'],
      default: 'text',
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 700
    },
    linkPreview: {
      type: linkPreviewSchema,
      default: null
    },
    reactions: {
      type: [reactionSchema],
      default: []
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

chatMessageSchema.index({ channelId: 1, createdAt: -1 });
chatMessageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
