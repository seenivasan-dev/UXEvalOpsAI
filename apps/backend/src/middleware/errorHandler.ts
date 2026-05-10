import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'
import { config } from '../config/env'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({
    correlationId: req.correlationId,
    err: err.message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    msg: 'unhandled error',
  })

  res.status(500).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
  })
}
