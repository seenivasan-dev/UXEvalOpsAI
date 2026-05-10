import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { config } from './config/env'
import { requestLogger, logger } from './middleware/logger'
import { errorHandler } from './middleware/errorHandler'
import evaluationsRouter from './routes/evaluations'
import reviewsRouter from './routes/reviews'

const app = express()

// Security headers
app.use(helmet())

// CORS
const allowedOrigins = [config.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'].filter(
  Boolean
) as string[]
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  })
)

// Body parsing
app.use(express.json({ limit: '50mb' }))

// Correlation ID + structured logging
app.use(requestLogger)

// Rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
)

// Routes
app.use('/api/evaluations', evaluationsRouter)
app.use('/api/reviews', reviewsRouter)

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
    version: '1.0.0',
  })
})

// Global error handler (must be last)
app.use(errorHandler)

app.listen(config.PORT, () => {
  logger.info({
    msg: 'EvalOps AI backend started',
    port: config.PORT,
    env: config.NODE_ENV,
  })
})

export default app
