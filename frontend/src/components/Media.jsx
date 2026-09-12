import { useState } from 'react'

// Renders an <img> or <video> depending on contentType, and fades it in
// once it actually finishes loading instead of popping in abruptly.
// Images use native lazy-loading so a long gallery (hundreds of photos)
// only fetches what's actually near the viewport, rather than blocking
// the whole page on every photo up front.
export default function Media({ src, contentType, className = '', alt = '', ...rest }) {
  const [loaded, setLoaded] = useState(false)
  const isVideo = contentType?.startsWith('video/')
  const combinedClassName = `media${loaded ? ' media--loaded' : ''}${className ? ` ${className}` : ''}`

  if (isVideo) {
    return (
      <video
        src={src}
        className={combinedClassName}
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        {...rest}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={combinedClassName}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      {...rest}
    />
  )
}
