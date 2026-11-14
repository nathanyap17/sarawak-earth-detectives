// The Partner: a rhinoceros hornbill built from primitives. It tilts its head when the student
// picks a red herring, and bobs gently otherwise. (Look only: the Partner's words come from the backend.)
// AI-assisted: written with Claude Code.
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { useSession } from '../state/session'

export function Hornbill() {
  const head = useRef<Group>(null)
  const body = useRef<Group>(null)
  const herring = useSession((s) => s.herringWarning)
  const atCabinet = useSession((s) => s.beat === 'locker')  // it follows the student to the evidence cabinet
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (head.current) {
      const target = herring ? 0.45 : Math.sin(t * 0.7) * 0.06
      head.current.rotation.z += (target - head.current.rotation.z) * Math.min(1, dt * 4)
      head.current.rotation.y = Math.sin(t * 0.4) * 0.25
    }
    if (body.current) body.current.position.y = Math.sin(t * 1.6) * 0.004
  })
  return (
    <group position={atCabinet ? [4.5, 1.6, -1.2] : [0.85, 0.78, -2.55]} rotation={[0, atCabinet ? -Math.PI / 2 : -0.5, 0]} scale={atCabinet ? 1.3 : 0.9}>
      {/* perch */}
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.07, 0.08, 0.04, 16]} /><meshStandardMaterial color="#4a3322" /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.012, 0.012, 0.14, 8]} /><meshStandardMaterial color="#4a3322" /></mesh>
      <mesh position={[0, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.16, 8]} /><meshStandardMaterial color="#4a3322" /></mesh>
      <group ref={body} position={[0, 0.27, 0]}>
        <mesh scale={[0.6, 1, 0.7]}><sphereGeometry args={[0.1, 20, 16]} /><meshStandardMaterial color="#141414" roughness={0.6} /></mesh>
        <mesh position={[0, -0.02, 0.05]} scale={[0.45, 0.6, 0.4]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color="#efe9dc" /></mesh>
        {/* tail: white with a black band */}
        <mesh position={[0, -0.12, -0.08]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.07, 0.16, 0.015]} /><meshStandardMaterial color="#f2efe6" /></mesh>
        <mesh position={[0, -0.17, -0.105]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.072, 0.03, 0.017]} /><meshStandardMaterial color="#141414" /></mesh>
        <group ref={head} position={[0, 0.12, 0.02]}>
          <mesh><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color="#141414" /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.035, 0.012, 0.02]}><sphereGeometry args={[0.008, 8, 8]} /><meshStandardMaterial color="#c8102e" emissive="#400" /></mesh>
          ))}
          {/* beak */}
          <mesh position={[0, -0.01, 0.1]} rotation={[Math.PI / 2 + 0.35, 0, 0]}><coneGeometry args={[0.022, 0.13, 12]} /><meshStandardMaterial color="#f1e3b5" /></mesh>
          {/* casque: the upturned red-orange horn */}
          <mesh position={[0, 0.035, 0.07]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[0.8, 1, 1.4]}><coneGeometry args={[0.02, 0.1, 12]} /><meshStandardMaterial color="#e2571e" /></mesh>
          <mesh position={[0, 0.05, 0.11]} rotation={[-0.6, 0, 0]}><coneGeometry args={[0.012, 0.05, 10]} /><meshStandardMaterial color="#f6c700" /></mesh>
        </group>
      </group>
    </group>
  )
}
