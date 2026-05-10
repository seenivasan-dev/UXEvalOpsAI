import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { reviewService } from '../services/reviewService'

const router = Router()

const reviewSchema = z.object({
  evaluationId: z.string().min(1),
  agentName: z.string().min(1),
  action: z.enum(['approved', 'rejected', 'escalated']),
  comment: z.string().optional(),
})

// GET /api/reviews/pending — MUST be before /:evaluationId
router.get('/pending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await reviewService.getPendingReviews()
    res.json(pending)
  } catch (err) {
    next(err)
  }
})

// POST /api/reviews
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reviewSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
        correlationId: req.correlationId,
      })
      return
    }

    const { evaluationId, agentName, action, comment } = parsed.data
    const review = await reviewService.submitReview(evaluationId, agentName, action, comment)
    res.status(201).json(review)
  } catch (err) {
    next(err)
  }
})

// GET /api/reviews/:evaluationId
router.get('/:evaluationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviews = await reviewService.getReviews(req.params.evaluationId)
    res.json(reviews)
  } catch (err) {
    next(err)
  }
})

export default router
