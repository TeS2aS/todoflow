const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      maxlength: 180
    },
    category: {
      type: String,
      trim: true,
      maxlength: 40
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const submissionItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const submissionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
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
    items: {
      type: [submissionItemSchema],
      default: []
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

const voteSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    category: {
      type: String,
      enum: ['useful', 'funny', 'chaotic', 'choice', 'impostor'],
      required: true
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    itemIndex: {
      type: Number,
      min: 0,
      default: 0
    },
    targetPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const scoreSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
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
    points: {
      type: Number,
      default: 0
    },
    breakdown: {
      type: [String],
      default: []
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const gameSessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameRoom',
      required: true,
      index: true
    },
    gameType: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['waiting', 'collecting', 'voting', 'finished'],
      default: 'waiting',
      index: true
    },
    round: {
      type: Number,
      default: 1
    },
    prompts: {
      type: [promptSchema],
      default: []
    },
    submissions: {
      type: [submissionSchema],
      default: []
    },
    votes: {
      type: [voteSchema],
      default: []
    },
    scores: {
      type: [scoreSchema],
      default: []
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameSessionSchema.index({ roomId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
