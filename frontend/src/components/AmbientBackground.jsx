import Silk from '@/components/Silk/Silk'

export default function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <Silk color="#b5735a" speed={3} scale={1} noiseIntensity={1.2} lightMode />
    </div>
  )
}
