const mongoose = require('mongoose')

const ScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  height: { type: Number, required: true },       // height in meters
  zombieScore: { type: Number, default: 0 },      // points from killing zombies
  totalScore: { type: Number, default: 0 },       // height + zombieScore
  platforms: { type: Number, default: 0 },        // platforms cleared that run
  createdAt: { type: Date, default: Date.now },
})

// Index for fast leaderboard queries
ScoreSchema.index({ totalScore: -1 })

module.exports = mongoose.model('Score', ScoreSchema)
