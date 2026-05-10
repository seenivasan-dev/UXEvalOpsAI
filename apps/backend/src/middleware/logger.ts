import pino from 'pino'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/env'

export const logger = pino({
  level: 'info',
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})

declare global {
  namespace Express {
    interface Request {
      correlationId: string
      startTime: number
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.correlationId = (req.headers['x-correlation-id'] as string) || uuidv4()
  req.startTime = Date.now()

  res.setHeader('x-correlation-id', req.correlationId)

  logger.info({
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    msg: 'request received',
  })

  res.on('finish', () => {
    logger.info({
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - req.startTime,
      msg: 'request completed',
    })
  })

  next()
}
