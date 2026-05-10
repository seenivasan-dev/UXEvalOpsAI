import 'dotenv/config'
import { Worker, Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { spawn } from 'child_process'
import path from 'path'
import { redis } from '../config/redis'
import { config } from '../config/env'
import { logger } from '../middleware/logger'
import { telemetryService } from '../telemetry/telemetryService'

const prisma = new PrismaClient()

interface AgentReport {
  overallScore: number
  grade: string
  topIssues: string[]
  summary: string
  agents: Array<{
    agent?: string
    agentName?: string
    score: number
    status: string
    findings: unknown[]
    recommendation: string
    reflected?: boolean
    durationMs?: number
  }>
  runId: string
  timestamp: string
  durationSeconds: number
}

function runPythonAgents(imageBase64: string): Promise<AgentReport> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '..', '..', '..', '..', 'python-agents', 'main.py')
    const child = spawn(config.PYTHON_PATH, [scriptPath], {
      env: { ...process.env },
    })

    let stdout = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      reject(new Error('Python agent timed out after 120 seconds'))
    }, 120_000)

    child.stdin.write(JSON.stringify({ image: imageBase64 }))
    child.stdin.end()

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      logger.info({ msg: '[python]', output: chunk.toString().trim() })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code !== 0) {
        reject(new Error(`Python agents exited with code ${code}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as AgentReport
        resolve(parsed)
      } catch {
        reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 200)}`))
      }
    })
  })
}

const worker = new Worker(
  'evaluations',
  async (job: Job) => {
    const { jobId, imageBase64 } = job.data as { jobId: string; imageBase64: string }

    logger.info({ jobId, msg: 'worker picked up evaluation job' })

    try {
      const report = await runPythonAgents(imageBase64)

      // Save each agent result
      for (const agent of report.agents) {
        const agentName = agent.agent ?? agent.agentName ?? 'Unknown'
        await prisma.agentResult.create({
          data: {
            evaluationId: jobId,
            agentName,
            score: agent.score,
            status: agent.status,
            findings: agent.findings as object[],
            recommendation: agent.recommendation,
            reflected: agent.reflected ?? false,
            durationMs: agent.durationMs ?? null,
          },
        })
      }

      // Update evaluation job to completed
      await prisma.evaluationJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          overallScore: report.overallScore,
          grade: report.grade,
          summary: report.summary,
          topIssues: report.topIssues,
          durationSeconds: report.durationSeconds,
        },
      })

      // Call eval service for scoring
      try {
        const evalRes = await fetch(`${config.EVAL_SERVICE_URL}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evaluationId: jobId, agents: report.agents }),
        })
        if (evalRes.ok) {
          const evalData = (await evalRes.json()) as {
            completeness: number
            schemaCompliance: number
          }
          await prisma.evalScore.create({
            data: {
              evaluationId: jobId,
              completeness: evalData.completeness,
              schemaCompliance: evalData.schemaCompliance,
            },
          })
        }
      } catch {
        logger.info({ msg: 'eval-service not available, skipping scoring' })
      }

      await telemetryService.trackEvent(jobId, 'evaluation.completed', {
        score: report.overallScore,
        grade: report.grade,
        durationSeconds: report.durationSeconds,
      })

      logger.info({ jobId, score: report.overallScore, msg: 'evaluation job completed' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ jobId, err: message, msg: 'evaluation job failed' })

      await prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: 'failed' },
      })

      await telemetryService.trackEvent(jobId, 'evaluation.failed', { error: message })
      throw err
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
)

worker.on('completed', (job) => {
  logger.info({ jobId: job.data.jobId, msg: 'job completed successfully' })
})

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.data?.jobId, err: err.message, msg: 'job failed' })
})

logger.info({ msg: 'BullMQ worker started — listening for evaluation jobs' })
