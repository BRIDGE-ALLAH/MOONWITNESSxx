import { Worker } from 'bullmq'
import type { ProductUploadJob } from '../index'
import { productUploadJob } from '../jobs/product-upload.job'

// Experimental transport adapter only. Business state remains owned by ARSY/domain services.
export const productUploadWorker = new Worker<ProductUploadJob>(
  'product-upload',
  async (job) => {
    const result = await productUploadJob(job.data)
    console.log(`✅ Job completed: ${job.id}`)
    console.log(`   Result: ${JSON.stringify(result)}`)
    return result
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    },
    concurrency: 4,
  }
)

console.log('🚀 Product Upload Worker started')
console.log('   Queue: product-upload')
console.log('   Connection: Redis')
console.log('   Concurrency: 4')

productUploadWorker.on('error', (error) => {
  console.error('❌ Worker error:', error)
})

productUploadWorker.on('completed', (job) => {
  console.log(`✅ Job completed: ${job.id} - ${job.name}`)
})

productUploadWorker.on('failed', (job, error) => {
  console.error(`❌ Job failed: ${job?.id}`, error)
})
