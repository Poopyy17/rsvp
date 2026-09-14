// One-time migration for the old nested attendee shape ({ guests,
// additionalGuests: [...] }) to the new flat shape, where every person
// (the original submitter and each guest they brought) is its own
// top-level attendee document, deduped by (nameKey, purokGrupo).
//
// For each existing document:
//   - Any entries in additionalGuests with a real name are upserted as
//     their own attendee documents (matched by their own name+purokGrupo,
//     inheriting the parent's purokGrupo when they didn't specify one).
//   - The parent document then has its now-unused `guests` and
//     `additionalGuests` fields removed.
//
// Usage:
//   node scripts/unnestAdditionalGuests.js            (dry run, no writes)
//   node scripts/unnestAdditionalGuests.js --apply     (actually writes)

require('dotenv').config()

const mongoose = require('mongoose')

const connectDB = require('../db')
const { normalizeNameKey } = require('../models')

const APPLY = process.argv.includes('--apply')

async function main() {
  await connectDB()

  const col = mongoose.connection.db.collection('attendees')
  const docs = await col.find({ $or: [{ guests: { $exists: true } }, { additionalGuests: { $exists: true } }] }).toArray()

  if (docs.length === 0) {
    console.log('No documents with the old guests/additionalGuests fields. Nothing to migrate.')
    await mongoose.disconnect()
    return
  }

  console.log(`Found ${docs.length} document(s) still on the old shape.`)

  let guestsToUpsert = 0
  let guestsSkippedNoName = 0

  for (const doc of docs) {
    const additionalGuests = Array.isArray(doc.additionalGuests) ? doc.additionalGuests : []

    for (const guest of additionalGuests) {
      const guestName = typeof guest?.name === 'string' ? guest.name.trim() : ''
      if (!guestName) {
        guestsSkippedNoName += 1
        continue
      }
      const guestPurokGrupo = (typeof guest?.purokGrupo === 'string' && guest.purokGrupo.trim()) || doc.purokGrupo
      const nameKey = normalizeNameKey(guestName)

      console.log(`- guest of ${doc._id}: upsert (nameKey=${JSON.stringify(nameKey)}, purokGrupo=${guestPurokGrupo})`)
      guestsToUpsert += 1

      if (APPLY) {
        await col.updateOne(
          { nameKey, purokGrupo: guestPurokGrupo },
          {
            $set: { name: guestName, nameKey, purokGrupo: guestPurokGrupo, attending: 'yes' },
            $setOnInsert: { createdAt: doc.createdAt || new Date() },
            $currentDate: { updatedAt: true },
          },
          { upsert: true }
        )
      }
    }

    console.log(`- ${doc._id}: drop guests/additionalGuests fields`)
    if (APPLY) {
      await col.updateOne({ _id: doc._id }, { $unset: { guests: '', additionalGuests: '' } })
    }
  }

  console.log(
    `\n${APPLY ? 'Applied' : 'Would apply'}: ${guestsToUpsert} guest(s) fanned out into their own documents` +
      (guestsSkippedNoName ? `, ${guestsSkippedNoName} unnamed guest(s) skipped` : '') +
      `, ${docs.length} parent document(s) cleaned up.`
  )
  if (!APPLY) {
    console.log('Dry run only — no changes made. Re-run with --apply to write.')
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
