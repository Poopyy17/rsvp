const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    originalName: String,
    contentType: String,
    size: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

const PUROK_GRUPO_PATTERN = /^\d+-\d+$/

// Case-insensitive identity for an attendee, paired with their exact
// purokGrupo — lets "Juan Cruz" and "juan cruz" in the same household be
// recognized as the same person instead of creating a duplicate row.
function normalizeNameKey(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : ''
}

const attendeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    purokGrupo: {
      type: String,
      required: true,
      trim: true,
      match: [PUROK_GRUPO_PATTERN, 'Purok & Grupo must be in the format "1-2".'],
    },
    attending: { type: String, required: true, enum: ['yes', 'no'] },
  },
  { timestamps: true }
)

attendeeSchema.pre('validate', function setNameKey() {
  this.nameKey = normalizeNameKey(this.name)
})

// Enforces one attendee row per (person, household) at the database level,
// regardless of how the name was cased on submission.
attendeeSchema.index({ nameKey: 1, purokGrupo: 1 }, { unique: true })

const Image = mongoose.model('Image', imageSchema)
const Attendee = mongoose.model('Attendee', attendeeSchema)

module.exports = { Image, Attendee, normalizeNameKey }
