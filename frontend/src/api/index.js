import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const client = axios.create({ baseURL: API_BASE_URL })

export async function submitRsvp(rsvp) {
  const { data } = await client.post('/api/rsvps', rsvp)
  return data
}

// Flattens each RSVP submission into one row per actual guest — the
// submitter plus one row per additional guest, each with their own
// Purok & Grupo — since additional guests are only ever recorded when the
// submitter is attending, they're always "attending" too.
function toGuestRows(rsvp) {
  const rows = [
    {
      id: rsvp.id,
      name: rsvp.name,
      purokGrupo: rsvp.purokGrupo,
      attending: rsvp.attending,
      createdAt: rsvp.createdAt,
    },
  ]
  rsvp.additionalGuests?.forEach((guest, index) => {
    rows.push({
      id: `${rsvp.id}-guest-${index}`,
      name: guest.name,
      purokGrupo: guest.purokGrupo,
      attending: 'yes',
      createdAt: rsvp.createdAt,
    })
  })
  return rows
}

export async function getRsvps() {
  const { data } = await client.get('/api/rsvps')
  return data.rsvps.flatMap(toGuestRows)
}

export async function getGuestCount() {
  const { data } = await client.get('/api/rsvps/count')
  return data
}

export async function uploadPhotos(files) {
  const formData = new FormData()
  files.forEach((file) => formData.append('photos', file))
  const { data } = await client.post('/api/photos', formData)
  return data
}

function toPhoto(image) {
  return {
    id: image.id,
    url: `${API_BASE_URL}${image.path}`,
    status: image.status,
    originalName: image.originalName,
    contentType: image.contentType,
    createdAt: image.createdAt,
  }
}

export async function getApprovedPhotos() {
  const { data } = await client.get('/api/photos/approved')
  return data.images.map(toPhoto)
}

export async function getPendingPhotos() {
  const { data } = await client.get('/api/photos/pending')
  return data.images.map(toPhoto)
}

export async function getAllPhotos() {
  const { data } = await client.get('/api/photos')
  return data.images.map(toPhoto)
}

export async function approvePhoto(id) {
  const { data } = await client.post(`/api/photos/${id}/approve`)
  return toPhoto(data)
}

export async function rejectPhoto(id) {
  const { data } = await client.post(`/api/photos/${id}/reject`)
  return toPhoto(data)
}

export async function deletePhoto(id) {
  await client.delete(`/api/photos/${id}`)
}
