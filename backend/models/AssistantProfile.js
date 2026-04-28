const mongoose = require('mongoose');

const assistantProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    preset: {
      type: String,
      enum: ['mambo', 'kratos', 'custom'],
      default: 'mambo',
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 40
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: 300,
      default: 'M'
    },
    color: {
      type: String,
      trim: true,
      maxlength: 24,
      default: '#0b7a75'
    },
    personality: {
      type: String,
      trim: true,
      maxlength: 160,
      default: ''
    },
    tone: {
      type: String,
      enum: ['drole', 'strict', 'calme', 'professionnel', 'sarcastique_soft', 'coach_sportif'],
      default: 'drole'
    },
    goals: {
      type: [String],
      default: ['productivite'],
      validate: {
        validator(goals) {
          return goals.length <= 6;
        },
        message: 'Goals are invalid'
      }
    },
    intensity: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    catchphrases: {
      type: [String],
      default: [],
      validate: {
        validator(items) {
          return items.length <= 8 && items.every((item) => item.length <= 120);
        },
        message: 'Catchphrases are invalid'
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('AssistantProfile', assistantProfileSchema);
