const mongoose = require('mongoose');

const gameSubmissionSchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 140
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameSubmissionSchema.index({ roomId: 1, userId: 1, createdAt: 1 });

module.exports = mongoose.model('GameSubmission', gameSubmissionSchema);
