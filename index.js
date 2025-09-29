const express = require('express')
const cors = require('cors')
const { Client } = require('pg')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello World from Arrakis!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Database connection test
app.get('/db-test', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'DATABASE_URL not configured',
      timestamp: new Date().toISOString()
    })
  }

  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    await client.connect()
    const result = await client.query('SELECT NOW() as current_time')
    await client.end()

    res.json({
      message: 'Database connection successful!',
      current_time: result.rows[0].current_time,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database connection error:', error)
    res.status(500).json({
      error: 'Database connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Arrakis server running on port ${port}`)
  console.log(`📊 Health check available at /health`)
  console.log(`🗄️  Database test available at /db-test`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})