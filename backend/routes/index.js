const { randomUUID } = require('node:crypto')
const express = require('express')
const multer = require('multer')
const mongoose = require('mongoose')
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const { Image, Attendee, normalizeNameKey } = require('../models')

const router = express.Router()

const s3 = new S3Client({ region: process.env.AWS_REGION })

// mongoose.connection.readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

router.get('/health', (req, res) => {
  const mongoState = MONGO_STATES[mongoose.connection.readyState] || 'unknown'
  const healthy = mongoose.connection.readyState === 1
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    mongo: mongoState,
    uptime: process.uptime(),
  })
})

const GUEST_LIMIT = 250
const MAX_GUESTS = 12

// The event's day, Asia/Manila time (UTC+8, no DST) — pinned explicitly so
// the cutoff means the same wall-clock moment regardless of where this
// server happens to run. Keep in sync with frontend/src/App.jsx.
const RSVP_CUTOFF = new Date('2026-09-27T00:00:00+08:00')

// Total confirmed headcount — declined RSVPs don't count against the cap.
// Every attendee document is exactly one person now, so this is a straight count.
async function getConfirmedGuestCount() {
  return Attendee.countDocuments({ attending: 'yes' })
}

// Turns one form submission (a primary attendee plus their optional
// additionalGuests) into the flat list of individual people it implies —
// each one gets its own attendee row, deduped independently by name +
// purokGrupo, so resubmitting the primary never touches anyone else's row.
function peopleFromSubmission({ name, purokGrupo, attending, guests, additionalGuests }) {
  const people = [{ name, purokGrupo, attending }]

  if (attending === 'yes' && Array.isArray(additionalGuests)) {
    if (additionalGuests.length !== Math.max(0, (guests ?? 0) - 1)) {
      throw Object.assign(new Error('Number of additional guests must match the guest count.'), {
        name: 'ValidationError',
        errors: { additionalGuests: { message: 'Number of additional guests must match the guest count.' } },
      })
    }
    for (const guest of additionalGuests) {
      const guestName = typeof guest?.name === 'string' ? guest.name.trim() : ''
      // A guest with no name can't be stored (name is required) or deduped
      // against later — skip it rather than error the whole submission out.
      if (!guestName) continue
      const guestPurokGrupo = (typeof guest?.purokGrupo === 'string' && guest.purokGrupo.trim()) || purokGrupo
      people.push({ name: guestName, purokGrupo: guestPurokGrupo, attending: 'yes' })
    }
  }

  return people
}

router.get('/rsvps/count', async (req, res) => {
  try {
    const count = await getConfirmedGuestCount()
    res.json({ count, limit: GUEST_LIMIT })
  } catch (err) {
    console.error('Failed to count guests:', err)
    res.status(500).json({ error: 'Failed to count guests.' })
  }
})

router.post('/rsvps', async (req, res) => {
  const { name, purokGrupo, attending, guests, additionalGuests } = req.body || {}

  try {
    if (Date.now() >= RSVP_CUTOFF.getTime()) {
      return res.status(409).json({
        error: "RSVPs are now closed — we've arrived at the day of the celebration.",
      })
    }

    if (typeof guests !== 'number' || guests < 1 || guests > MAX_GUESTS) {
      return res.status(400).json({ error: `Number of guests must be between 1 and ${MAX_GUESTS}.` })
    }

    // One submission (a primary attendee plus their optional additional
    // guests) becomes N independent people, each with their own row —
    // resubmitting the primary only ever matches and updates their own row,
    // never anyone else's.
    const people = peopleFromSubmission({ name, purokGrupo, attending, guests, additionalGuests })

    // Validate every implied person before writing any of them, so one bad
    // entry can't leave a submission half-applied.
    for (const person of people) {
      await new Attendee(person).validate()
    }

    // Resubmitting the same person (case-insensitive name + exact
    // purokGrupo) updates their existing row instead of creating a
    // duplicate — the form never shows a "you already RSVP'd" error.
    const existingByPerson = new Map()
    let guestLimitDelta = 0
    for (const person of people) {
      const existing = await Attendee.findOne({ nameKey: normalizeNameKey(person.name), purokGrupo: person.purokGrupo })
      existingByPerson.set(person, existing)
      const oldContribution = existing?.attending === 'yes' ? 1 : 0
      const newContribution = person.attending === 'yes' ? 1 : 0
      guestLimitDelta += newContribution - oldContribution
    }

    if (guestLimitDelta > 0) {
      const currentCount = await getConfirmedGuestCount()
      if (currentCount + guestLimitDelta > GUEST_LIMIT) {
        return res.status(409).json({
          error: `We're so sorry — we've reached our limit of ${GUEST_LIMIT} guests and can no longer accept new RSVPs.`,
        })
      }
    }

    let primaryAttendee = null
    let primaryWasExisting = false
    for (const person of people) {
      const nameKey = normalizeNameKey(person.name)
      const existing = existingByPerson.get(person)
      const attendee = existing
        ? await Attendee.findOneAndUpdate(
            { nameKey, purokGrupo: person.purokGrupo },
            { $set: { ...person, nameKey } },
            { returnDocument: 'after' }
          )
        : await Attendee.create({ ...person, nameKey })

      if (person === people[0]) {
        primaryAttendee = attendee
        primaryWasExisting = Boolean(existing)
      }
    }

    res.status(primaryWasExisting ? 200 : 201).json({ id: primaryAttendee._id })
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid RSVP data.'
      return res.status(400).json({ error: message })
    }
    console.error('Failed to save RSVP:', err)
    res.status(500).json({ error: 'Failed to submit RSVP.' })
  }
})

router.get('/rsvps', async (req, res) => {
  try {
    const attendees = await Attendee.find().sort({ createdAt: -1 })
    res.json({
      rsvps: attendees.map((attendee) => ({
        id: attendee._id,
        name: attendee.name,
        purokGrupo: attendee.purokGrupo,
        attending: attendee.attending,
        createdAt: attendee.createdAt,
      })),
    })
  } catch (err) {
    console.error('Failed to load RSVPs:', err)
    res.status(500).json({ error: 'Failed to load RSVPs.' })
  }
})

function toRsvp(attendee) {
  return {
    id: attendee._id,
    name: attendee.name,
    purokGrupo: attendee.purokGrupo,
    attending: attendee.attending,
    createdAt: attendee.createdAt,
  }
}

router.put('/rsvps/:id', async (req, res) => {
  const { name, purokGrupo, attending } = req.body || {}

  try {
    const attendee = await Attendee.findById(req.params.id)
    if (!attendee) return res.status(404).json({ error: 'Guest not found.' })

    // Only an attendee newly turning "yes" here counts against the cap —
    // one already confirmed isn't adding a new head, and staying/going
    // "no" never does.
    if (attending === 'yes' && attendee.attending !== 'yes') {
      const currentCount = await getConfirmedGuestCount()
      if (currentCount + 1 > GUEST_LIMIT) {
        return res.status(409).json({
          error: `We're so sorry — we've reached our limit of ${GUEST_LIMIT} guests and can no longer accept new RSVPs.`,
        })
      }
    }

    attendee.set({ name, purokGrupo, attending })
    await attendee.save()

    res.json(toRsvp(attendee))
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Guest not found.' })
    }
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid guest data.'
      return res.status(400).json({ error: message })
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A guest with that name and Purok & Grupo already exists.' })
    }
    console.error('Failed to update guest:', err)
    res.status(500).json({ error: 'Failed to update guest.' })
  }
})

router.delete('/rsvps/:id', async (req, res) => {
  try {
    const attendee = await Attendee.findByIdAndDelete(req.params.id)
    if (!attendee) return res.status(404).json({ error: 'Guest not found.' })
    res.status(204).end()
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Guest not found.' })
    }
    console.error('Failed to delete guest:', err)
    res.status(500).json({ error: 'Failed to delete guest.' })
  }
})

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 15 * 1024 * 1024

function isAllowedImage(mimetype) {
  return mimetype.startsWith('image/') && mimetype !== 'image/gif'
}

function isAllowedVideo(mimetype) {
  return mimetype.startsWith('video/')
}

const upload = multer({
  storage: multer.memoryStorage(),
  // Multer only enforces one size ceiling per field, so it's set to the
  // larger (video) limit here; the stricter per-type image limit is
  // checked explicitly in the route handler below.
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter(req, file, cb) {
    cb(null, isAllowedImage(file.mimetype) || isAllowedVideo(file.mimetype))
  },
})

function handleUpload(req, res, next) {
  upload.array('photos', 5)(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Videos must be 15MB or smaller.' })
    }
    console.error('Upload middleware error:', err)
    res.status(400).json({ error: 'Upload failed.' })
  })
}

router.post('/photos', handleUpload, async (req, res) => {
  const files = req.files || []

  if (files.length === 0) {
    return res.status(400).json({ error: 'No photos provided. Only images (no GIFs) or videos up to 15MB are accepted.' })
  }

  const oversizedImage = files.find((file) => isAllowedImage(file.mimetype) && file.size > MAX_IMAGE_SIZE)
  if (oversizedImage) {
    return res.status(400).json({ error: 'Images must be 10MB or smaller.' })
  }

  try {
    const images = await Promise.all(
      files.map(async (file) => {
        const key = `photos/${Date.now()}-${randomUUID()}-${file.originalname}`
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        )
        return Image.create({
          key,
          originalName: file.originalname,
          contentType: file.mimetype,
          size: file.size,
        })
      })
    )

    res.status(201).json({
      images: images.map((image) => ({ id: image._id, status: image.status })),
    })
  } catch (err) {
    console.error('Photo upload failed:', err)
    res.status(500).json({ error: 'Upload failed.' })
  }
})

function toSummary(image) {
  return {
    id: image._id,
    path: `/api/photos/${image._id}/file`,
    status: image.status,
    originalName: image.originalName,
    contentType: image.contentType,
    createdAt: image.createdAt,
  }
}

async function listPhotos(filter) {
  const images = await Image.find(filter).sort({ createdAt: -1 })
  return images.map(toSummary)
}

router.get('/photos', async (req, res) => {
  try {
    res.json({ images: await listPhotos({}) })
  } catch (err) {
    console.error('Failed to load photos:', err)
    res.status(500).json({ error: 'Failed to load photos.' })
  }
})

router.get('/photos/pending', async (req, res) => {
  try {
    res.json({ images: await listPhotos({ status: 'pending' }) })
  } catch (err) {
    console.error('Failed to load pending photos:', err)
    res.status(500).json({ error: 'Failed to load pending photos.' })
  }
})

router.get('/photos/approved', async (req, res) => {
  try {
    res.json({ images: await listPhotos({ status: 'approved' }) })
  } catch (err) {
    console.error('Failed to load approved photos:', err)
    res.status(500).json({ error: 'Failed to load approved photos.' })
  }
})

router.post('/photos/:id/approve', async (req, res) => {
  try {
    const image = await Image.findByIdAndUpdate(req.params.id, { status: 'approved' }, { returnDocument: 'after' })
    if (!image) return res.status(404).json({ error: 'Photo not found.' })
    res.json(toSummary(image))
  } catch (err) {
    console.error('Failed to approve photo:', err)
    res.status(500).json({ error: 'Failed to approve photo.' })
  }
})

router.post('/photos/:id/reject', async (req, res) => {
  try {
    const image = await Image.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { returnDocument: 'after' })
    if (!image) return res.status(404).json({ error: 'Photo not found.' })
    res.json(toSummary(image))
  } catch (err) {
    console.error('Failed to reject photo:', err)
    res.status(500).json({ error: 'Failed to reject photo.' })
  }
})

router.delete('/photos/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id)
    if (!image) return res.status(404).json({ error: 'Photo not found.' })

    // S3's DeleteObject is idempotent — it succeeds even if the key is
    // already gone — so this only throws for a genuine failure (permissions,
    // network, wrong bucket). Only delete the MongoDB record once S3
    // deletion is confirmed, so the two stores never drift out of sync:
    // no orphaned S3 object left behind with its record silently gone.
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: image.key }))

    await image.deleteOne()
    res.status(204).end()
  } catch (err) {
    console.error('Failed to delete photo:', err)
    res.status(500).json({ error: 'Failed to delete photo.' })
  }
})

// Stable, cacheable URL per photo — unlike a presigned S3 URL (which gets a
// fresh signature every time it's generated, defeating any HTTP/CDN cache),
// this path never changes for a given photo, so a CDN in front of this API
// (e.g. Vercel) only pulls it from S3 once and serves everyone else from
// its own cache.
//
// Serves pending, approved, and rejected photos alike (the admin table needs
// to preview any of them). There's no auth system yet distinguishing "admin"
// from "public" — this matches the rest of the app's current (unauthenticated)
// trust model, and should be locked down once real admin auth exists.
router.get('/photos/:id/file', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id)
    if (!image) {
      return res.status(404).end()
    }

    const object = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: image.key })
    )

    res.set('Content-Type', image.contentType || 'application/octet-stream')
    if (image.size) res.set('Content-Length', image.size)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    object.Body.pipe(res)
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.warn(`Photo ${req.params.id} has a record but is missing from S3 (deleted out-of-band?)`)
    } else {
      console.error('Failed to stream photo:', err)
    }
    res.status(404).end()
  }
})

module.exports = router
