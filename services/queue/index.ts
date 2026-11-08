import { enqueueProductUpload, enqueueAnalysisJob, scheduleProductReview } from '@riotworks/bullmq'

// Queue Service — consumer untuk ARSY Headquarter
// Letakkan di: services/queue/

// Enqueue product upload job
export async function submitProductUpload({
  productId,
  filePath,
  userId,
  priority = 'normal'
}: {
  productId: string
  filePath: string
  userId: string
  priority?: 'high' | 'normal' | 'low'
}) {
  const jobId = await enqueueProductUpload('product-upload', {
    productId,
    filePath,
    userId,
    priority
  })
  return { jobId, status: 'enqueued' }
}

// Enqueue analysis job
export async function submitSignalAnalysis({
  signalId,
  analysisType,
  parameters
}: {
  signalId: string
  analysisType: 'market' | 'competitor' | 'trend'
  parameters?: Record<string, any>
}) {
  const jobId = await enqueueAnalysisJob('signal-analysis', {
    signalId,
    analysisType,
    parameters
  })
  return { jobId, status: 'enqueued' }
}

// Schedule recurring review
export async function scheduleDailyProductReview(productId: string) {
  await scheduleProductReview('product-upload', productId)
  return { status: 'scheduled' }
}