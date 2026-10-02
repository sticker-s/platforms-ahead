require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')

const authRoutes = require('./routes/auth')
const scoreRoutes = require('./routes/scores')

const app = express()

// Middleware
const allowedOrigins = process.env.CLIENT_ORIGIN 
  ? process.env.CLIENT_ORIGIN.split(',')
  : ['http://localhost:5173']

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
      callback(null, true)
    } else {
      callback(null, true) // Allow requests in deployment
    }
  }, 
  credentials: true 
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/scores', scoreRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
  })
}

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3001
const MONGO_URI = process.env.MONGO_URI

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected')
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message)
    process.exit(1)
  })
