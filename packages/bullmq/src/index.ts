import { Queue } from 'bullmq'

export type ProductUploadJob = {
  productId: string
  filePath: string
  userId: string
  priority?: 1 | 2 | 3
}

export type AnalysisJob = {
  signalId: string
  analysisType: 'market' | 'competitor' | 'trend'
  parameters?: Record<string, unknown>
}

function getRedisConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  }
}

export async function enqueueProductUpload(
  queueName: 'product-upload',
  job: ProductUploadJob
): Promise<string> {
  const queue = new Queue<ProductUploadJob>(queueName, {
    connection: getRedisConnection(),
  })

  try {
    const created = await queue.add('product-upload', job, {
      priority: job.priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    })

    if (!created.id) throw new Error('BullMQ did not return a job ID.')
    return created.id
  } finally {
    await queue.close()
  }
}

export async function enqueueAnalysisJob(
  queueName: 'signal-analysis',
  job: AnalysisJob
): Promise<string> {
  const queue = new Queue<AnalysisJob>(queueName, {
    connection: getRedisConnection(),
  })

  try {
    const created = await queue.add('signal-analysis', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    })

    if (!created.id) throw new Error('BullMQ did not return a job ID.')
    return created.id
  } finally {
    await queue.close()
  }
}

export async function scheduleProductReview(
  queueName: 'product-upload',
  productId: string
): Promise<void> {
  const queue = new Queue<{ productId: string }>(queueName, {
    connection: getRedisConnection(),
  })

  try {
    await queue.add(
      'product-review',
      { productId },
      {
        jobId: `product-review:${productId}`,
        repeat: {
          pattern: '0 2 * * *',
        },
      }
    )
  } finally {
    await queue.close()
  }
}
