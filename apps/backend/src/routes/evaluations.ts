import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { evaluationService } from '../services/evaluationService'
import { telemetryService } from '../telemetry/telemetryService'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'))
    }
  },
})

// GET /api/evaluations/telemetry/summary — MUST be before /:id
router.get('/telemetry/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await telemetryService.getSummary()
    res.json(summary)
  } catch (err) {
    next(err)
  }
})

// POST /api/evaluations/upload
router.post(
  '/upload',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided', correlationId: req.correlationId })
        return
      }
      const imageBase64 = req.file.buffer.toString('base64')
      const job = await evaluationService.createEvaluation(imageBase64, req.file.originalname)
      res.status(201).json(job)
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/evaluations
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const evaluations = await evaluationService.listEvaluations()
    res.json(evaluations)
  } catch (err) {
    next(err)
  }
})

// GET /api/evaluations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evaluation = await evaluationService.getEvaluation(req.params.id)
    res.json(evaluation)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Evaluation not found', correlationId: req.correlationId })
      return
    }
    next(err)
  }
})

// DELETE /api/evaluations/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await evaluationService.deleteEvaluation(req.params.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
