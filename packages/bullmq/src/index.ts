import { Queue } from 'bullmq'
import { QueueScheduler } from 'bullmq'

// Job definition types
export type ProductUploadJob = {
  productId: string
  filePath: string
  userId: string
  priority?: 'high' | 'normal' | 'low'
}

export type AnalysisJob = {
  signalId: string
  analysisType: 'market' | 'competitor' | 'trend'
  parameters?: Record<string, any>
}

// Producer — create and push jobs
export async function enqueueProductUpload(
  queueName: 'product-upload',
  job: ProductUploadJob
): Promise<string> {
  const queue = new Queue(queueName, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    },
  })

  const jobId = await queue.add('product-upload', job, {
    priority: job.priority || 'normal',
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  })

  return jobId
}

export async function enqueueAnalysisJob(
  queueName: 'signal-analysis',
  job: AnalysisJob
): Promise<string> {
  const queue = new Queue(queueName, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    },
  })

  const jobId = await queue.add('signal-analysis', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  })

  return jobId
}

// Scheduler — recurring jobs
export async function scheduleProductReview(
  queueName: 'product-upload',
  productId: string
): Promise<void> {
  const queue = new Queue(queueName, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    },
  })

  await new QueueScheduler(queueName, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    },
  }).scheduleEvery('product-review', {
    productId,
    cronTime: '0 2 * * *', // Every day at 02:00
  })
}