import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import AmbientBackground from '@/components/AmbientBackground'
import '../App.css'
import './PhotoUpload.css'

const MAX_PHOTOS = 5

export default function PhotoUpload() {
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    document.title = 'Upload Photos'
  }, [])

  useEffect(() => {
    return () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    setStatus('idle')
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length
      if (room <= 0) return prev
      const additions = acceptedFiles.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }))
      return [...prev, ...additions]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    disabled: photos.length >= MAX_PHOTOS || status === 'submitting',
  })

  function removePhoto(id) {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((photo) => photo.id !== id)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (photos.length === 0) return

    setStatus('submitting')
    const formData = new FormData()
    photos.forEach(({ file }) => formData.append('photos', file))

    try {
      await axios.post('/api/photos', formData)
      setStatus('success')
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
      setPhotos([])
    } catch {
      setStatus('error')
    }
  }

  const isFull = photos.length >= MAX_PHOTOS

  return (
    <main className="page">
      <AmbientBackground />
      <div className="card">
        <header className="invitation">
          <p className="eyebrow">Share the memories</p>
          <h1 className="event-name">Upload Photos</h1>
          <div className="ornament" aria-hidden="true">
            <span className="ornament-line" />
            <span className="ornament-mark" />
            <span className="ornament-line" />
          </div>
          <p className="event-details">Drag and drop up to {MAX_PHOTOS} photos to share with the family.</p>
        </header>

        <form className="upload-form" onSubmit={handleSubmit}>
          <div
            {...getRootProps({
              className: `dropzone${isDragActive ? ' dropzone--active' : ''}${isFull ? ' dropzone--full' : ''}`,
            })}
          >
            <input {...getInputProps()} />
            <p>{isFull ? 'Maximum of 5 photos selected' : isDragActive ? 'Drop the photos here' : 'Drag & drop photos here, or click to browse'}</p>
            <p className="dropzone-hint">
              {photos.length}/{MAX_PHOTOS} selected
            </p>
          </div>

          {fileRejections.length > 0 && (
            <p className="upload-message upload-message--error">Only image files are accepted.</p>
          )}

          {photos.length > 0 && (
            <ul className="photo-grid">
              {photos.map((photo) => (
                <li key={photo.id} className="photo-thumb">
                  <img src={photo.preview} alt="" />
                  <button
                    type="button"
                    className="photo-remove"
                    aria-label={`Remove ${photo.file.name}`}
                    onClick={() => removePhoto(photo.id)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status === 'success' && (
            <p className="upload-message upload-message--success">Photos uploaded — thank you!</p>
          )}
          {status === 'error' && (
            <p className="upload-message upload-message--error">Something went wrong. Please try again.</p>
          )}

          <Button type="submit" className="submit-button" disabled={photos.length === 0 || status === 'submitting'}>
            {status === 'submitting' ? 'Uploading…' : 'Upload photos'}
          </Button>
        </form>
      </div>
    </main>
  )
}
