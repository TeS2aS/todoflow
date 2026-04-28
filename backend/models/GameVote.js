const mongoose = require('mongoose');

const gameVoteSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameRoom',
      required: true,
      index: true
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSubmission',
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ['funny', 'useful', 'chaotic'],
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameVoteSchema.index({ roomId: 1, voterId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('GameVote', gameVoteSchema);
