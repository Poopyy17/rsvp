import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import './PasswordGate.css'

// A numeric, OTP-style access code prompt. Renders as a non-dismissible
// modal (no close button, outside click/Escape do nothing) until `code`
// is entered correctly, then calls `onUnlock` once. The caller is
// responsible for not fetching/rendering anything sensitive until then.
export default function PasswordGate({ code, title, description, onUnlock }) {
  const length = code.length
  const [digits, setDigits] = useState(() => Array(length).fill(''))
  const [error, setError] = useState(false)
  const inputRefs = useRef([])

  function focusBox(index) {
    inputRefs.current[index]?.focus()
  }

  function handleChange(index, rawValue) {
    const value = rawValue.replace(/\D/g, '').slice(-1)
    setError(false)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    if (value && index < length - 1) focusBox(index + 1)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusBox(index - 1)
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    event.preventDefault()
    setError(false)
    setDigits(Array.from({ length }, (_, i) => pasted[i] ?? ''))
    focusBox(Math.min(pasted.length, length - 1))
  }

  useEffect(() => {
    if (digits.some((digit) => digit === '')) return

    if (digits.join('') === code) {
      onUnlock()
      return
    }

    setError(true)
    setDigits(Array(length).fill(''))
    focusBox(0)
    // Only re-check once every box is filled, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  return (
    <Dialog open modal disablePointerDismissal>
      <DialogContent className="password-gate-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className={`otp-row${error ? ' otp-row--error' : ''}`} onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              className="otp-box"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              aria-label={`Digit ${index + 1} of ${length}`}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {error && <p className="otp-error">Incorrect code. Try again.</p>}
      </DialogContent>
    </Dialog>
  )
}
