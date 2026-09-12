import { Loader2 } from 'lucide-react'

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <p className="gallery-status">
      <Loader2 className="animate-spin" aria-hidden="true" />
      {label}
    </p>
  )
}
