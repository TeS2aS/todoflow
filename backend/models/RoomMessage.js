const mongoose = require('mongoose');

const roomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameRoom',
      required: true,
      index: true
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    type: {
      type: String,
      enum: ['system', 'user', 'game'],
      default: 'user'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

roomMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('RoomMessage', roomMessageSchema);
