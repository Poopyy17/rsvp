// One-time cleanup: finds attendees that collide on the new (case-insensitive
// name, purokGrupo) uniqueness rule and keeps only the most recently
// submitted document per group, deleting the rest. Must be run once before
// the unique index on { nameKey, purokGrupo } can be created successfully.
//
// Usage:
//   node scripts/mergeDuplicateAttendees.js            (dry run, no writes)
//   node scripts/mergeDuplicateAttendees.js --apply     (actually deletes)

require('dotenv').config()

const mongoose = require('mongoose')

const connectDB = require('../db')

const APPLY = process.argv.includes('--apply')

async function findDuplicateGroups() {
  const db = mongoose.connection.db
  return db
    .collection('attendees')
    .aggregate([
      {
        $group: {
          _id: {
            nameKey: { $toLower: { $trim: { input: '$name' } } },
            purokGrupo: '$purokGrupo',
          },
          docs: { $push: { id: '$_id', updatedAt: '$updatedAt', createdAt: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray()
}

async function main() {
  await connectDB()

  const groups = await findDuplicateGroups()
  if (groups.length === 0) {
    console.log('No duplicate attendees found. Safe to create the unique index.')
    await mongoose.disconnect()
    return
  }

  console.log(`Found ${groups.length} duplicate group(s), ${groups.reduce((sum, g) => sum + g.count, 0)} document(s) total.`)

  const idsToDelete = []
  for (const group of groups) {
    const sorted = [...group.docs].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt).getTime()
      return bTime - aTime
    })
    const [keep, ...drop] = sorted
    console.log(`- group ${JSON.stringify(group._id)}: keeping ${keep.id}, dropping ${drop.map((d) => d.id).join(', ')}`)
    idsToDelete.push(...drop.map((d) => d.id))
  }

  if (!APPLY) {
    console.log(`\nDry run only — no changes made. Re-run with --apply to delete ${idsToDelete.length} document(s).`)
  } else {
    const result = await mongoose.connection.db.collection('attendees').deleteMany({ _id: { $in: idsToDelete } })
    console.log(`\nDeleted ${result.deletedCount} document(s).`)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Merge failed:', err)
  process.exit(1)
})
