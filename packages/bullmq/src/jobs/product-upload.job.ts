import type { ProductUploadJob } from '../index'

// Prototype processor only; it does not upload files or persist business data yet.
export async function productUploadJob(payload: ProductUploadJob) {
  const { productId, filePath, userId } = payload

  console.log(`🔄 Processing product upload: ${productId}`)
  console.log(`   File: ${filePath}`)
  console.log(`   User: ${userId}`)

  // TODO: validate file, upload to storage, persist metadata, and run integrity checks.
  return {
    status: 'prototype-completed',
    productId,
    processedAt: new Date().toISOString(),
  }
}
