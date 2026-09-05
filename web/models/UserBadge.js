

const mongoose = require('mongoose');

const userBadgeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  badgeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
    required: true
  },
  awardedBy: {
    type: String,
    required: true
  },
  awardedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can't have the same badge twice in a guild
userBadgeSchema.index({ userId: 1, guildId: 1, badgeId: 1 }, { unique: true });

module.exports = mongoose.model('UserBadge', userBadgeSchema);

