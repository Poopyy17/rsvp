require('dotenv').config()

const mongoose = require('mongoose')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const connectDB = require('./db')
const { Image } = require('./models')

const s3 = new S3Client({ region: process.env.AWS_REGION })

// 1x1 transparent PNG, used as lightweight sample content — swap for real
// photos once the admin approval flow is in place.
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

async function uploadSample(name) {
  const key = `photos/seed-${Date.now()}-${name}.png`
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: SAMPLE_PNG,
      ContentType: 'image/png',
    })
  )
  return key
}

async function seedImages() {
  const count = await Image.countDocuments()
  if (count > 0) {
    console.log(`Images collection already has ${count} document(s) — skipping seed.`)
    return
  }

  const approvedKey = await uploadSample('approved')
  const pendingKey = await uploadSample('pending')

  await Image.create([
    {
      key: approvedKey,
      originalName: 'seed-approved.png',
      contentType: 'image/png',
      size: SAMPLE_PNG.length,
      status: 'approved',
    },
    {
      key: pendingKey,
      originalName: 'seed-pending.png',
      contentType: 'image/png',
      size: SAMPLE_PNG.length,
      status: 'pending',
    },
  ])

  console.log('Seeded 2 sample images (1 approved, 1 pending).')
}

async function ensureAttendeesCollection() {
  // Schema isn't defined yet — just make sure the collection exists so it
  // shows up alongside images. No sample documents inserted.
  const collections = await mongoose.connection.db.listCollections({ name: 'attendees' }).toArray()
  if (collections.length > 0) {
    console.log('Attendees collection already exists.')
    return
  }

  await mongoose.connection.db.createCollection('attendees')
  console.log('Created empty attendees collection.')
}

async function main() {
  await connectDB()
  await seedImages()
  await ensureAttendeesCollection()
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
