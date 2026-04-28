const mongoose = require('mongoose');

const gamePlayerSchema = new mongoose.Schema(
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
      required: true,
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
      trim: true,
      maxlength: 120,
      default: ''
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

gamePlayerSchema.index({ roomId: 1, userId: 1 }, { unique: true });
gamePlayerSchema.index({ roomId: 1, score: -1, updatedAt: 1 });

module.exports = mongoose.model('GamePlayer', gamePlayerSchema);
