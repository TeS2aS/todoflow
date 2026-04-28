const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: ''
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 12,
      index: true
    },
    settings: {
      allowMemberInvites: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

groupSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
