const express = require('express')
const crypto = require('crypto')
const User = require('../models/User')

const router = express.Router()

// Simple SHA-256 hash for passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'platformer_salt_2024').digest('hex')
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' })
    }
    if (username.length < 2 || username.length > 24) {
      return res.status(400).json({ error: 'Username must be 2–24 characters.' })
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' })
    }

    const existing = await User.findOne({ username: username.trim() })
    if (existing) {
      return res.status(409).json({ error: 'Username already taken.' })
    }

    const user = await User.create({
      username: username.trim(),
      passwordHash: hashPassword(password),
    })

    return res.status(201).json({
      message: 'Account created!',
      user: { id: user._id, username: user.username },
    })
  } catch (err) {
    console.error('Signup error:', err)
    return res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' })
    }

    const user = await User.findOne({ username: username.trim() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    if (user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    return res.json({
      message: 'Logged in!',
      user: { id: user._id, username: user.username },
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
