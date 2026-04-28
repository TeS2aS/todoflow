const mongoose = require('mongoose');

const roomSettingsSchema = new mongoose.Schema(
  {
    maxPlayers: {
      type: Number,
      min: 2,
      max: 12,
      default: 8
    },
    roundDuration: {
      type: Number,
      enum: [30, 60, 90],
      default: 60
    },
    allowAnonymousPlayers: {
      type: Boolean,
      default: true
    },
    enableChat: {
      type: Boolean,
      default: true
    },
    familyFriendlyMode: {
      type: Boolean,
      default: true
    },
    chaosMode: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const gameRoomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 8,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['lobby', 'playing', 'voting', 'finished'],
      default: 'lobby',
      index: true
    },
    currentGame: {
      type: String,
      default: ''
    },
    theme: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ''
    },
    roundEndsAt: {
      type: Date,
      default: null,
      index: true
    },
    currentRound: {
      type: Number,
      default: 0
    },
    settings: {
      type: roomSettingsSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameRoomSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('GameRoom', gameRoomSchema);
