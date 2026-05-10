-- CreateTable
CREATE TABLE "EvaluationJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imageFileName" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "overallScore" INTEGER,
    "grade" TEXT,
    "summary" TEXT,
    "topIssues" TEXT[],
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentResult" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "reflected" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "schemaCompliance" DOUBLE PRECISION NOT NULL,
    "humanAgreement" DOUBLE PRECISION,
    "driftFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalScore_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentResult" ADD CONSTRAINT "AgentResult_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalScore" ADD CONSTRAINT "EvalScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
