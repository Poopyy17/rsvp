// Adapted from reactbits.dev's Counter component
// (https://reactbits.dev/components/counter), source verified against
// github.com/DavidHDev/react-bits (public/r/Counter-JS-CSS.json).
//
// Two deliberate deviations from the copied source:
// - Added the `.top-gradient` CSS rule (missing from the original, its
//   `.bottom-gradient` counterpart is what actually positions it).
// - The rolling-digit animation is driven by Motion springs, not CSS, so
//   this project's global `prefers-reduced-motion` override (which only
//   targets CSS animation/transition durations) can't reach it — added an
//   explicit `useReducedMotion` check that snaps the spring near-instantly
//   instead, to keep the same accessibility bar as the rest of the app.
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'

import './Counter.css'

function Number({ mv, number, height }) {
  let y = useTransform(mv, (latest) => {
    let placeValue = latest % 10
    let offset = (10 + number - placeValue) % 10
    let memo = offset * height
    if (offset > 5) {
      memo -= 10 * height
    }
    return memo
  })
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  )
}

function normalizeNearInteger(num) {
  const nearest = Math.round(num)
  const tolerance = 1e-9 * Math.max(1, Math.abs(num))
  return Math.abs(num - nearest) < tolerance ? nearest : num
}

function getValueRoundedToPlace(value, place) {
  const scaled = value / place
  return Math.floor(normalizeNearInteger(scaled))
}

function Digit({ place, value, height, digitStyle }) {
  const prefersReducedMotion = useReducedMotion()
  const isDecimal = place === '.'
  const valueRoundedToPlace = isDecimal ? 0 : getValueRoundedToPlace(value, place)
  const animatedValue = useSpring(valueRoundedToPlace, prefersReducedMotion ? { duration: 0.001, bounce: 0 } : undefined)

  useEffect(() => {
    if (!isDecimal) {
      animatedValue.set(valueRoundedToPlace)
    }
  }, [animatedValue, valueRoundedToPlace, isDecimal])

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, ...digitStyle, width: 'fit-content' }}>
        .
      </span>
    )
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  )
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places = [...value.toString()].map((ch, i, a) => {
    if (ch === '.') {
      return '.'
    } else {
      return 10 ** (a.indexOf('.') === -1 ? a.length - i - 1 : i < a.indexOf('.') ? a.indexOf('.') - i - 1 : -(i - a.indexOf('.')))
    }
  }),
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle,
}) {
  const height = fontSize + padding
  const defaultCounterStyle = {
    fontSize,
    gap: gap,
    borderRadius: borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight: fontWeight,
    direction: 'ltr',
  }
  const defaultTopGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  }
  const defaultBottomGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  }
  return (
    <span className="counter-container" style={containerStyle}>
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {places.map((place) => (
          <Digit key={place} place={place} value={value} height={height} digitStyle={digitStyle} />
        ))}
      </span>
      <span className="gradient-container">
        <span className="top-gradient" style={topGradientStyle ? topGradientStyle : defaultTopGradientStyle}></span>
        <span
          className="bottom-gradient"
          style={bottomGradientStyle ? bottomGradientStyle : defaultBottomGradientStyle}
        ></span>
      </span>
    </span>
  )
}
