import { PrismaClient, EvaluationJob } from '@prisma/client'
import { evaluationQueue } from '../jobs/queue'
import { telemetryService } from '../telemetry/telemetryService'
import { logger } from '../middleware/logger'

const prisma = new PrismaClient()

class EvaluationService {
  async createEvaluation(imageBase64: string, fileName: string): Promise<EvaluationJob> {
    const job = await prisma.evaluationJob.create({
      data: {
        imageFileName: fileName,
        imageBase64,
        status: 'pending',
      },
    })

    await telemetryService.trackEvent(job.id, 'evaluation.created', { fileName })

    await evaluationQueue.add('run', { jobId: job.id, imageBase64 })

    logger.info({ jobId: job.id, fileName, msg: 'evaluation job enqueued' })

    return job
  }

  async getEvaluation(id: string) {
    const job = await prisma.evaluationJob.findUnique({
      where: { id },
      include: {
        agentResults: { orderBy: { createdAt: 'asc' } },
        reviews: { orderBy: { reviewedAt: 'desc' } },
        telemetry: { orderBy: { timestamp: 'asc' } },
        evalScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!job) {
      const err = new Error(`Evaluation ${id} not found`)
      ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
      throw err
    }

    return job
  }

  async listEvaluations() {
    return prisma.evaluationJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { agentResults: true, reviews: true } },
      },
    })
  }

  async deleteEvaluation(id: string): Promise<void> {
    await prisma.evaluationJob.delete({ where: { id } })
  }
}

export const evaluationService = new EvaluationService()
