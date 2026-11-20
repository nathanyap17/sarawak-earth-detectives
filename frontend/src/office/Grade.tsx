// The film look for the office: reflections from a light rig built in code (no HDR download),
// ambient occlusion in corners and under objects, a soft glow on lamps, film tone curve and a
// little grain. The vignette is CSS on the stage (index.css).
//
// The effect chain is always on, so every material is compiled once, for one render path. On a
// slow device only the costly parts (ambient occlusion, glow, multisampling) are dropped: that
// changes no material shader, so there is no freeze and the colours do not jump. The speed check
// starts only after the room has loaded (`armed`), so the first-frame upload is not mistaken for
// a slow device.
// AI-assisted: written with Claude Code.
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useEffect, useState } from 'react'
import { isHandheld } from './orientation'

/** Reflections only: a warm window, a lamp-lit ceiling and dark walls, rendered once. */
function Reflections() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.55}>
      <color attach="background" args={['#120c08']} />
      <Lightformer form="rect" intensity={5} color="#ffb067" position={[0, 2.4, -6]} scale={[4, 2.4, 1]} />
      <Lightformer form="circle" intensity={2.2} color="#ffd9a0" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={3} />
      <Lightformer form="rect" intensity={0.8} color="#9fb7d8" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ffe6c8" position={[0, 2, 8]} rotation-y={Math.PI} scale={[8, 3, 1]} />
    </Environment>
  )
}

function Rich() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={2.4} halfRes color="#120a05" />
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.75} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise opacity={0.045} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}

function Light() {
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise opacity={0.045} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}

export function Grade({ armed }: { armed: boolean }) {
  const fx = (() => { try { return localStorage.getItem('sed-fx') } catch { return null } })()
  const forced = fx === 'on'   // screenshots on slow test machines
  // phones and tablets start on the light chain: ambient occlusion, glow and 4x multisampling are the
  // biggest GPU memory users, and running out of it is what blanks the 3D view on a phone.
  // 'off' forces the light chain on any device (tests the slow-device path).
  const [rich, setRich] = useState(fx !== 'off' && !isHandheld())
  const [watching, setWatching] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setWatching(true), 2500)      // let the first uploads settle
    return () => clearTimeout(t)
  }, [armed])
  return (
    <>
      <Reflections />
      {watching && !forced && <PerformanceMonitor bounds={() => [26, 60]} onDecline={() => setRich(false)} onFallback={() => setRich(false)} />}
      {rich || forced ? <Rich /> : <Light />}
    </>
  )
}
