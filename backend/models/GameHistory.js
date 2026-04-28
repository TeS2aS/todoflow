const mongoose = require('mongoose');

const historyScoreSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    nickname: {
      type: String,
      trim: true,
      maxlength: 32
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: 8
    },
    score: {
      type: Number,
      default: 0
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const gameHistorySchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameRoom',
      required: true,
      index: true
    },
    winners: {
      type: [historyScoreSchema],
      default: []
    },
    finalScores: {
      type: [historyScoreSchema],
      default: []
    },
    funnySummary: {
      type: String,
      trim: true,
      maxlength: 180,
      default: ''
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameHistorySchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('GameHistory', gameHistorySchema);
