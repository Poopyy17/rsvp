import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import Counter from '@/components/Counter'
import AmbientBackground from '@/components/AmbientBackground'
import SealBurst from '@/components/SealBurst'
import { getGuestCount, submitRsvp } from '@/api'
import { useLoading } from '@/lib/loading-context'
import './App.css'

const EVENT = {
  date: 'Sunday, the 27th of September',
  time: '5:00 PM in the afternoon',
  venue: 'Villa Susana, Vatican City Dr, Talon 2 Las Piñas City',
}

const MAX_GUESTS = 12

// The event's day, Asia/Manila time (UTC+8, no DST) — pinned explicitly so
// the cutoff means the same wall-clock moment regardless of where the
// visitor's browser (or the server) happens to think it is. RSVPs close
// once the event has arrived. Keep in sync with backend/routes/index.js.
const RSVP_CUTOFF = new Date('2026-09-27T00:00:00+08:00')

// Purok and Grupo are each a plain number, written as "purok-grupo" (e.g. "1-2").
const PUROK_GRUPO_PATTERN = /^\d+-\d+$/

const initialForm = {
  name: '',
  purokGrupo: '',
  attending: null,
  guests: 1,
  additionalGuests: [],
}

const emptyAdditionalGuest = { name: '', purokGrupo: '' }

const SUBMIT_ID = 'rsvp-submit'

function GuestTally({ count, limit }) {
  // Mount at 0 and step to the real count a tick later, so the digits
  // actually roll into view instead of appearing already-settled — the
  // Counter only animates a value *change*, and by the time we know the
  // real count (after the fetch resolves) there's nothing left to animate
  // if we hand it the final number straight away.
  const [displayCount, setDisplayCount] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayCount(count))
    return () => cancelAnimationFrame(frame)
  }, [count])

  return (
    <div className="guest-tally">
      <span aria-hidden="true">
        <Counter
          value={displayCount}
          fontSize={18}
          padding={5}
          gap={0}
          borderRadius={0}
          horizontalPadding={0}
          gradientHeight={5}
          gradientFrom="var(--surface)"
          gradientTo="transparent"
          textColor="var(--accent)"
          fontWeight="600"
        />
        <span className="guest-tally-max"> of {limit} guests joining us</span>
      </span>
      <span className="sr-only" role="status">
        {count} of {limit} guests have confirmed so far.
      </span>
    </div>
  )
}

function EventHeader() {
  return (
    <header className="invitation">
      <p className="eyebrow">You are cordially invited</p>
      <h1 className="event-name">
        80<span className="event-name-suffix">th</span> Anniversary of
        <br />
        Lokal ng Pamplona
      </h1>
      <div className="ornament" aria-hidden="true">
        <span className="ornament-line" />
        <span className="ornament-mark" />
        <span className="ornament-line" />
      </div>
      <p className="event-details">
        {EVENT.date} &middot; {EVENT.time}
        <br />
        {EVENT.venue}
      </p>
    </header>
  )
}

function sanitizePurokGrupo(value) {
  return value.replace(/\s+/g, '-').replace(/[^\d-]/g, '')
}

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name.'
  if (!PUROK_GRUPO_PATTERN.test(form.purokGrupo)) {
    errors.purokGrupo = 'Please use the format "1-2" (purok-grupo).'
  }
  if (!form.attending) errors.attending = 'Please let us know if you can attend.'

  const additionalGuestErrors = form.additionalGuests.map((guest) =>
    guest.purokGrupo && !PUROK_GRUPO_PATTERN.test(guest.purokGrupo)
      ? { purokGrupo: 'Please use the format "1-2" (purok-grupo).' }
      : null
  )
  if (additionalGuestErrors.some(Boolean)) errors.additionalGuests = additionalGuestErrors

  return errors
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [confirmedGuestCount, setConfirmedGuestCount] = useState(null)
  const [guestLimit, setGuestLimit] = useState(null)
  const [countStatus, setCountStatus] = useState('loading')
  const { pendingId, run } = useLoading()
  const submitting = pendingId === SUBMIT_ID
  const pastCutoff = Date.now() >= RSVP_CUTOFF.getTime()

  function refreshGuestCount() {
    return getGuestCount()
      .then(({ count, limit }) => {
        setConfirmedGuestCount(count)
        setGuestLimit(limit)
        setCountStatus('ready')
      })
      .catch(() => setCountStatus('error'))
  }

  useEffect(() => {
    // No point checking capacity once RSVPs are closed for the date.
    if (pastCutoff) return
    refreshGuestCount()
    // Only ever runs once, at mount — intentionally not reactive to pastCutoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function setGuestCount(nextGuests) {
    setForm((prev) => {
      const extraCount = Math.max(0, nextGuests - 1)
      const additionalGuests = Array.from(
        { length: extraCount },
        (_, index) => prev.additionalGuests[index] ?? emptyAdditionalGuest
      )
      return { ...prev, guests: nextGuests, additionalGuests }
    })
  }

  function updateAdditionalGuest(index, field, value) {
    setForm((prev) => {
      const additionalGuests = prev.additionalGuests.map((guest, i) =>
        i === index ? { ...guest, [field]: value } : guest
      )
      return { ...prev, additionalGuests }
    })
    setErrors((prev) => {
      if (!prev.additionalGuests?.[index]?.[field]) return prev
      const additionalGuests = prev.additionalGuests.map((guestErrors, i) =>
        i === index ? { ...guestErrors, [field]: undefined } : guestErrors
      )
      return { ...prev, additionalGuests }
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (pendingId !== null) return

    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError(null)
    run(SUBMIT_ID, async () => {
      try {
        await submitRsvp({
          name: form.name.trim(),
          purokGrupo: form.purokGrupo,
          attending: form.attending,
          guests: form.guests,
          additionalGuests: form.additionalGuests.map((guest) => ({
            name: guest.name.trim(),
            purokGrupo: guest.purokGrupo,
          })),
        })
        setSubmitted(form)
        refreshGuestCount()
      } catch (err) {
        setSubmitError(err.response?.data?.error || 'Something went wrong. Please try again.')
      }
    })
  }

  function handleReset() {
    setForm(initialForm)
    setErrors({})
    setSubmitError(null)
    setSubmitted(null)
    refreshGuestCount()
  }

  if (pastCutoff) {
    return (
      <main className="page">
        <AmbientBackground />
        <div className="card card--confirmation">
          <p className="confirmation-title">We're so sorry.</p>
          <p className="confirmation-body">
            RSVPs are now closed — we&rsquo;ve arrived at the day of the celebration. Thank you so much for your love
            and support!
          </p>
        </div>
      </main>
    )
  }

  if (countStatus === 'loading') {
    return (
      <main className="page">
        <AmbientBackground />
        <div className="card card--confirmation">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <p className="confirmation-body">Loading…</p>
        </div>
      </main>
    )
  }

  const guestLimitReached = countStatus === 'ready' && confirmedGuestCount >= guestLimit

  if (submitted) {
    const firstName = submitted.name.trim().split(/\s+/)[0]
    return (
      <main className="page">
        <AmbientBackground />
        <div className="card card--confirmation">
          <SealBurst />
          <h1 className="confirmation-title">Thank you, {firstName}.</h1>
          <p className="confirmation-body">
            {submitted.attending === 'yes'
              ? `We're delighted you'll be joining us for the evening.`
              : `We're sorry you won't be able to join us — you will be missed.`}
          </p>
          <Button type="button" variant="link" className="link-button" onClick={handleReset}>
            Submit another response
          </Button>
        </div>
      </main>
    )
  }

  if (guestLimitReached) {
    return (
      <main className="page">
        <AmbientBackground />
        <div className="card card--confirmation">
          <p className="confirmation-title">We're so sorry.</p>
          <p className="confirmation-body">
            We've reached our limit of {guestLimit} guests and can no longer accept new RSVPs. Thank you so much for
            your understanding — we hope to celebrate with you again soon.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <AmbientBackground />
      <div className="card">
        <EventHeader />

        {countStatus === 'ready' && <GuestTally count={confirmedGuestCount} limit={guestLimit} />}

        <form className="rsvp-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
            {errors.name && (
              <p className="field-error" id="name-error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field">
            <Label htmlFor="purok-grupo">Purok & Grupo</Label>
            <Input
              id="purok-grupo"
              name="purok-grupo"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1-2"
              required
              aria-invalid={errors.purokGrupo ? 'true' : undefined}
              aria-describedby={errors.purokGrupo ? 'purok-grupo-error' : undefined}
              value={form.purokGrupo}
              onChange={(event) => update('purokGrupo', sanitizePurokGrupo(event.target.value))}
            />
            {errors.purokGrupo && (
              <p className="field-error" id="purok-grupo-error">
                {errors.purokGrupo}
              </p>
            )}
          </div>

          <fieldset className="field">
            <legend>Will you attend?</legend>
            <RadioGroup
              className={`toggle toggle--${form.attending ?? 'none'}`}
              name="attending"
              value={form.attending}
              onValueChange={(value) => update('attending', value)}
              aria-invalid={errors.attending ? 'true' : undefined}
              aria-describedby={errors.attending ? 'attending-error' : undefined}
              required
            >
              <span className="toggle-indicator" aria-hidden="true" />
              <RadioGroupItem value="yes">Joyfully accepts</RadioGroupItem>
              <RadioGroupItem value="no">Regretfully declines</RadioGroupItem>
            </RadioGroup>
            {errors.attending && (
              <p className="field-error" id="attending-error">
                {errors.attending}
              </p>
            )}
          </fieldset>

          <div className={`reveal ${form.attending === 'yes' ? 'reveal--open' : ''}`}>
            <div className="reveal-inner">
              <div className="field">
                <Label htmlFor="guests">Number of guests, including yourself</Label>
                <div className="stepper">
                  <Button
                    type="button"
                    variant="ghost"
                    className="stepper-button"
                    onClick={() => setGuestCount(Math.max(1, form.guests - 1))}
                    disabled={form.guests <= 1}
                    aria-label="Decrease guest count"
                  >
                    &minus;
                  </Button>
                  <span className="stepper-value">
                    <span aria-hidden="true">
                      <Counter
                        value={form.guests}
                        fontSize={16}
                        padding={6}
                        gap={0}
                        borderRadius={0}
                        horizontalPadding={0}
                        gradientHeight={6}
                        gradientFrom="var(--surface)"
                        gradientTo="transparent"
                        textColor="var(--ink)"
                        fontWeight="inherit"
                      />
                    </span>
                    <span className="sr-only" id="guests" aria-live="polite">
                      {form.guests} guests
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="stepper-button"
                    onClick={() => setGuestCount(Math.min(MAX_GUESTS, form.guests + 1))}
                    disabled={form.guests >= MAX_GUESTS}
                    aria-label="Increase guest count"
                  >
                    +
                  </Button>
                </div>
              </div>

              {form.additionalGuests.length > 0 && (
                <div className="guest-names">
                  {form.additionalGuests.map((guest, index) => {
                    const guestError = errors.additionalGuests?.[index]
                    return (
                      <div className="guest-entry" key={index}>
                        <p className="guest-entry-title">Guest {index + 2}</p>
                        <div className="guest-entry-row">
                          <div className="field guest-entry-name">
                            <Label htmlFor={`guest-name-${index}`}>Name</Label>
                            <Input
                              id={`guest-name-${index}`}
                              type="text"
                              autoComplete="off"
                              value={guest.name}
                              onChange={(event) => updateAdditionalGuest(index, 'name', event.target.value)}
                            />
                          </div>
                          <div className="field guest-entry-purok">
                            <Label htmlFor={`guest-purok-grupo-${index}`}>Purok & Grupo</Label>
                            <Input
                              id={`guest-purok-grupo-${index}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="e.g. 1-2"
                              aria-invalid={guestError?.purokGrupo ? 'true' : undefined}
                              aria-describedby={guestError?.purokGrupo ? `guest-purok-grupo-${index}-error` : undefined}
                              value={guest.purokGrupo}
                              onChange={(event) =>
                                updateAdditionalGuest(index, 'purokGrupo', sanitizePurokGrupo(event.target.value))
                              }
                            />
                            {guestError?.purokGrupo && (
                              <p className="field-error" id={`guest-purok-grupo-${index}-error`}>
                                {guestError.purokGrupo}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {submitError && <p className="field-error form-error">{submitError}</p>}

          <Button type="submit" className="submit-button" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Sending…' : 'Send RSVP'}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default App
