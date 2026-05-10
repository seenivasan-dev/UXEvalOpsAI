import { PrismaClient, TelemetryEvent } from '@prisma/client'
import { logger } from '../middleware/logger'

const prisma = new PrismaClient()

interface TelemetrySummary {
  totalEvaluations: number
  avgScore: number
  avgDuration: number
  successRate: number
  topIssueCategories: string[]
}

class TelemetryService {
  async trackEvent(
    evaluationId: string,
    event: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await prisma.telemetryEvent.create({
      data: { evaluationId, event, metadata: metadata as object },
    })
    logger.info({ evaluationId, event, metadata, msg: 'telemetry event tracked' })
  }

  async getEvents(evaluationId: string): Promise<TelemetryEvent[]> {
    return prisma.telemetryEvent.findMany({
      where: { evaluationId },
      orderBy: { timestamp: 'asc' },
    })
  }

  async getSummary(): Promise<TelemetrySummary> {
    const [total, completed, scoreAgg, durationAgg, agentNames] = await Promise.all([
      prisma.evaluationJob.count(),
      prisma.evaluationJob.count({ where: { status: 'completed' } }),
      prisma.evaluationJob.aggregate({
        _avg: { overallScore: true },
        where: { overallScore: { not: null } },
      }),
      prisma.evaluationJob.aggregate({
        _avg: { durationSeconds: true },
        where: { durationSeconds: { not: null } },
      }),
      prisma.agentResult.groupBy({
        by: ['agentName'],
        _count: { agentName: true },
        orderBy: { _count: { agentName: 'desc' } },
        take: 5,
      }),
    ])

    return {
      totalEvaluations: total,
      avgScore: Math.round(scoreAgg._avg.overallScore ?? 0),
      avgDuration: Math.round((durationAgg._avg.durationSeconds ?? 0) * 10) / 10,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      topIssueCategories: agentNames.map((a) => a.agentName),
    }
  }
}

export const telemetryService = new TelemetryService()
