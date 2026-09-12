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

const MAX_GUESTS = 12
const PUROK_GRUPO_PATTERN = /^\d+-\d+$/

const additionalGuestSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    purokGrupo: {
      type: String,
      trim: true,
      default: '',
      validate: {
        // Optional per additional guest, but must be well-formed if given.
        validator: (value) => value === '' || PUROK_GRUPO_PATTERN.test(value),
        message: 'Purok & Grupo must be in the format "1-2".',
      },
    },
  },
  { _id: false }
)

const attendeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    purokGrupo: {
      type: String,
      required: true,
      trim: true,
      match: [PUROK_GRUPO_PATTERN, 'Purok & Grupo must be in the format "1-2".'],
    },
    attending: { type: String, required: true, enum: ['yes', 'no'] },
    guests: { type: Number, required: true, min: 1, max: MAX_GUESTS },
    additionalGuests: {
      type: [additionalGuestSchema],
      default: [],
      validate: {
        validator(additionalGuests) {
          return additionalGuests.length === Math.max(0, this.guests - 1)
        },
        message: 'Number of additional guests must match the guest count.',
      },
    },
  },
  { timestamps: true }
)

const Image = mongoose.model('Image', imageSchema)
const Attendee = mongoose.model('Attendee', attendeeSchema)

module.exports = { Image, Attendee }
