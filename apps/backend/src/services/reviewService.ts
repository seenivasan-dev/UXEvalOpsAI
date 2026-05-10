import { PrismaClient, Review } from '@prisma/client'
import { telemetryService } from '../telemetry/telemetryService'

const prisma = new PrismaClient()

const VALID_ACTIONS = ['approved', 'rejected', 'escalated'] as const
type ReviewAction = (typeof VALID_ACTIONS)[number]

class ReviewService {
  async submitReview(
    evaluationId: string,
    agentName: string,
    action: ReviewAction,
    comment?: string
  ): Promise<Review> {
    const review = await prisma.review.create({
      data: { evaluationId, agentName, action, comment },
    })

    await telemetryService.trackEvent(evaluationId, 'review.submitted', {
      agentName,
      action,
    })

    return review
  }

  async getReviews(evaluationId: string): Promise<Review[]> {
    return prisma.review.findMany({
      where: { evaluationId },
      orderBy: { reviewedAt: 'desc' },
    })
  }

  async getPendingReviews() {
    const completed = await prisma.evaluationJob.findMany({
      where: { status: 'completed' },
      include: {
        agentResults: true,
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return completed.filter((job) => job.reviews.length === 0)
  }
}

export const reviewService = new ReviewService()
