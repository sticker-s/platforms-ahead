const express = require('express')
const Score = require('../models/Score')
const User = require('../models/User')

const router = express.Router()

// GET /api/scores/leaderboard?limit=20
// Returns top scores (one per user — their personal best)
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)

    // Aggregate: for each user, get their highest totalScore
    const leaderboard = await Score.aggregate([
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          bestScore: { $max: '$totalScore' },
          bestHeight: { $max: '$height' },
          bestZombieScore: { $max: '$zombieScore' },
          bestPlatforms: { $max: '$platforms' },
          gamesPlayed: { $sum: 1 },
        },
      },
      { $sort: { bestScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          username: 1,
          bestScore: 1,
          bestHeight: 1,
          bestZombieScore: 1,
          bestPlatforms: 1,
          gamesPlayed: 1,
        },
      },
    ])

    return res.json({ leaderboard })
  } catch (err) {
    console.error('Leaderboard error:', err)
    return res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/scores
// Submit a score after a game ends
router.post('/', async (req, res) => {
  try {
    const { userId, height, platforms, zombieScore } = req.body

    if (!userId || height === undefined) {
      return res.status(400).json({ error: 'userId and height are required.' })
    }
    if (typeof height !== 'number' || height < 0) {
      return res.status(400).json({ error: 'Invalid height value.' })
    }

    // Verify user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    const zScore = Math.round(zombieScore || 0)
    const total = Math.round(height) + zScore

    const score = await Score.create({
      userId: user._id,
      username: user.username,
      height: Math.round(height),
      zombieScore: zScore,
      totalScore: total,
      platforms: Math.round(platforms || 0),
    })

    return res.status(201).json({ message: 'Score saved!', score })
  } catch (err) {
    console.error('Score submit error:', err)
    return res.status(500).json({ error: 'Server error.' })
  }
})

// GET /api/scores/user/:userId — personal score history
router.get('/user/:userId', async (req, res) => {
  try {
    const scores = await Score.find({ userId: req.params.userId })
      .sort({ totalScore: -1 })
      .limit(10)
      .lean()
    return res.json({ scores })
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
