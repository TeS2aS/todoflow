const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Email is invalid']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    refreshTokens: [
      {
        tokenHash: {
          type: String,
          required: true
        },
        expiresAt: {
          type: Date,
          required: true,
          index: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    passwordResetTokenHash: {
      type: String,
      select: false
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpiresAt;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
