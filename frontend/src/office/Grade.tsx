// The film look for the office: reflections from a light rig built in code (no HDR download),
// ambient occlusion in corners and under objects, a soft glow on lamps, film tone curve,
// vignette and a little grain. It switches itself off on slow devices, so a school laptop
// gets the plain room at a usable frame rate instead of a slideshow.
// AI-assisted: written with Claude Code.
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useEffect, useState } from 'react'
import { ACESFilmicToneMapping, NoToneMapping } from 'three'

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

/** Post effects. The composer applies the tone curve itself, so the renderer's is turned off. */
function Film() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMapping = NoToneMapping
    return () => { gl.toneMapping = ACESFilmicToneMapping }
  }, [gl])
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={2.4} halfRes color="#120a05" />
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.75} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.62} />
      <Noise opacity={0.045} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}

export function Grade() {
  const [fx, setFx] = useState(true)
  const forced = (() => { try { return localStorage.getItem('sed-fx') === 'on' } catch { return false } })()   // for screenshots on slow test machines
  return (
    <>
      <Reflections />
      <PerformanceMonitor bounds={() => [28, 60]} flipflops={2} onDecline={() => setFx(false)} onFallback={() => setFx(false)} />
      {(fx || forced) && <Film />}
    </>
  )
}
