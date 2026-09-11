import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import Counter from '@/components/Counter'
import AmbientBackground from '@/components/AmbientBackground'
import './App.css'

const EVENT = {
  date: 'Tuesday, the 29th of September',
  time: '5:00 PM in the afternoon',
  venue: 'Villa Susana, Vatican City Dr, Talon 2 Las Piñas City',
}

const MAX_GUESTS = 12

const initialForm = {
  name: '',
  purokGrupo: '',
  attending: null,
  guests: 1,
  notes: '',
}

const SPARKLES = Array.from({ length: 10 }, (_, i) => ({
  angle: i * 36,
  distance: 30 + (i % 3) * 8,
  delay: (i % 5) * 18,
}))

function SealBurst() {
  return (
    <span className="seal-wrap" aria-hidden="true">
      <span className="confetti-burst">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="confetti-particle"
            style={{
              '--angle': `${s.angle}deg`,
              '--distance': `${s.distance}px`,
              '--delay': `${s.delay}ms`,
            }}
          />
        ))}
      </span>
      <span className="seal">
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M15 24.5l6 6 12-13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  )
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [submitted, setSubmitted] = useState(null)
  const notesId = useId()

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.attending) return
    setSubmitted(form)
  }

  function handleReset() {
    setForm(initialForm)
    setSubmitted(null)
  }

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

  return (
    <main className="page">
      <AmbientBackground />
      <div className="card">
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

        <form className="rsvp-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </div>

          <div className="field">
            <Label htmlFor="purok-grupo">Purok & Grupo</Label>
            <Input
              id="purok-grupo"
              name="purok-grupo"
              type="text"
              autoComplete="off"
              placeholder="e.g. 1-2"
              required
              value={form.purokGrupo}
              onChange={(event) => update('purokGrupo', event.target.value)}
            />
          </div>

          <fieldset className="field">
            <legend>Will you attend?</legend>
            <RadioGroup
              className={`toggle toggle--${form.attending ?? 'none'}`}
              name="attending"
              value={form.attending}
              onValueChange={(value) => update('attending', value)}
              required
            >
              <span className="toggle-indicator" aria-hidden="true" />
              <RadioGroupItem value="yes">Joyfully accepts</RadioGroupItem>
              <RadioGroupItem value="no">Regretfully declines</RadioGroupItem>
            </RadioGroup>
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
                    onClick={() => update('guests', Math.max(1, form.guests - 1))}
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
                    onClick={() => update('guests', Math.min(MAX_GUESTS, form.guests + 1))}
                    disabled={form.guests >= MAX_GUESTS}
                    aria-label="Increase guest count"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="field">
                <Label htmlFor={notesId}>Kindly list all the name of guests (optional)</Label>
                <Textarea
                  id={notesId}
                  rows={3}
                  placeholder="e.g. Juan Dela Cruz, Maria Dela Cruz"
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="submit-button">
            Send RSVP
          </Button>
        </form>
      </div>
    </main>
  )
}

export default App
