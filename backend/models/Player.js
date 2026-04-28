const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameRoom',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    nickname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 32
    },
    avatar: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8
    },
    score: {
      type: Number,
      default: 0,
      min: 0
    },
    isHost: {
      type: Boolean,
      default: false
    },
    isReady: {
      type: Boolean,
      default: false
    },
    connected: {
      type: Boolean,
      default: true,
      index: true
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

playerSchema.index(
  { roomId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true } }
  }
);
playerSchema.index({ roomId: 1, connected: 1, score: -1 });

module.exports = mongoose.model('Player', playerSchema);
