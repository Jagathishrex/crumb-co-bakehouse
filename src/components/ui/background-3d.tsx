import * as React from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Stage3D, useCssColor, useSceneTime } from "@/components/ui/scene-3d"
import { cn } from "cn"

// A moving 3D background in the theme's colours: drifting particles, a wavy field of dots or soft floating blobs.
// Clicks pass through it to what sits on top. For a hero: a "relative isolate" parent, and className="absolute inset-0 -z-10".
// Empty colours are the theme's chart-1 and chart-2.

type Effect = "particles" | "waves" | "blobs"

/** A soft round dot, so points are not drawn as squares. */
function useDot(): THREE.Texture {
  const texture = React.useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 64
    const context = canvas.getContext("2d")!
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, "rgba(255,255,255,1)")
    glow.addColorStop(0.5, "rgba(255,255,255,0.9)")
    glow.addColorStop(1, "rgba(255,255,255,0)")
    context.fillStyle = glow
    context.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [])
  React.useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Particles({ color, color2, density, speed }: { color: string; color2: string; density: number; speed: number }) {
  const points = React.useRef<THREE.Points>(null)
  const dot = useDot()
  const time = useSceneTime()
  const geometry = React.useMemo(() => {
    const count = Math.round(450 * density)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const first = new THREE.Color(color)
    const second = new THREE.Color(color2)
    // The same scatter every time, so pictures and videos match.
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let index = 0; index < count; index++) {
      positions.set([(random() - 0.5) * 12, (random() - 0.5) * 7, (random() - 0.5) * 6], index * 3)
      const mixed = first.clone().lerp(second, random())
      colors.set([mixed.r, mixed.g, mixed.b], index * 3)
    }
    const made = new THREE.BufferGeometry()
    made.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    made.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return made
  }, [color, color2, density])
  React.useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((state) => {
    const at = time(state) * speed
    if (!points.current) return
    points.current.rotation.y = at * 0.05
    points.current.rotation.x = Math.sin(at * 0.1) * 0.1
  })
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial map={dot} size={0.26} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function Waves({ color, color2, density, speed }: { color: string; color2: string; density: number; speed: number }) {
  const points = React.useRef<THREE.Points>(null)
  const dot = useDot()
  const time = useSceneTime()
  const side = Math.round(60 * Math.sqrt(density))
  const geometry = React.useMemo(() => {
    const positions = new Float32Array(side * side * 3)
    const colors = new Float32Array(side * side * 3)
    const first = new THREE.Color(color)
    const second = new THREE.Color(color2)
    for (let row = 0; row < side; row++) {
      for (let column = 0; column < side; column++) {
        const index = row * side + column
        positions.set([(column / (side - 1) - 0.5) * 14, 0, (row / (side - 1) - 0.5) * 10], index * 3)
        const mixed = first.clone().lerp(second, column / (side - 1))
        colors.set([mixed.r, mixed.g, mixed.b], index * 3)
      }
    }
    const made = new THREE.BufferGeometry()
    made.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    made.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return made
  }, [color, color2, side])
  React.useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((state) => {
    const at = time(state) * speed
    const position = geometry.getAttribute("position") as THREE.BufferAttribute
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index)
      const z = position.getZ(index)
      position.setY(index, Math.sin(x * 0.8 + at) * 0.3 + Math.cos(z * 0.9 + at * 0.8) * 0.3)
    }
    position.needsUpdate = true
  })
  return (
    <points ref={points} geometry={geometry} position={[0, -1.2, -1]}>
      <pointsMaterial map={dot} size={0.13} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function Blobs({ color, color2, density, speed }: { color: string; color2: string; density: number; speed: number }) {
  const group = React.useRef<THREE.Group>(null)
  const time = useSceneTime()
  const count = Math.max(2, Math.round(5 * density))
  const blobs = React.useMemo(() => Array.from({ length: count }, (_, index) => ({ x: ((index * 2.3) % 8) - 4, y: ((index * 1.7) % 4) - 2, size: 0.6 + ((index * 0.37) % 0.8), tint: index % 2 ? color2 : color })), [count, color, color2])
  useFrame((state) => {
    const at = time(state) * speed
    group.current?.children.forEach((child, index) => {
      child.position.x = blobs[index].x + Math.sin(at * 0.4 + index) * 0.6
      child.position.y = blobs[index].y + Math.cos(at * 0.5 + index * 2) * 0.4
    })
  })
  return (
    <group ref={group}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 4, 5]} intensity={1.5} />
      {blobs.map((blob, index) => (
        <mesh key={index} position={[blob.x, blob.y, -1 - (index % 3)]} scale={blob.size}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshPhysicalMaterial color={blob.tint} roughness={0.15} metalness={0} clearcoat={1} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Background3D({
  effect = "particles",
  color = "",
  color2 = "",
  density = 1,
  speed = 1,
  background = "",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "color"> & {
  effect?: Effect
  color?: string
  color2?: string
  density?: number
  speed?: number
  background?: string
}) {
  // Empty colours are the theme's first two chart colours.
  const first = useCssColor(color || "var(--chart-1)", "#6366f1")
  const second = useCssColor(color2 || "var(--chart-2)", "#22d3ee")
  const look = { color: first, color2: second, density: Math.max(0.1, density), speed }
  return (
    <Stage3D slot="background-3d" camera={[0, 0, 6]} fov={50} background={background} environment="none" shadows={false} orbit={false} className={cn("pointer-events-none h-80 w-full rounded-none", className)} {...props}>
      {effect === "waves" ? <Waves {...look} /> : effect === "blobs" ? <Blobs {...look} /> : <Particles {...look} />}
    </Stage3D>
  )
}

export { Background3D }
