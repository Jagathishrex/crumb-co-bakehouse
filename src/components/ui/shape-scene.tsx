import * as React from "react"
import * as THREE from "three"
import { useFrame, useLoader } from "@react-three/fiber"
import { FontLoader } from "three/addons/loaders/FontLoader.js"
import { TextGeometry } from "three/addons/geometries/TextGeometry.js"
import { Lights, Loading, ShadowFloor, Stage3D, spinAt, useCssColor, useSceneTime, type Light3D, type Stage3DProps } from "@/components/ui/scene-3d"

// A scene of simple 3D shapes, one row each: cube, sphere, torus, cone, cylinder, knot, capsule or 3D text, with
// its colour, place, size, finish and spin. Shapes float gently and the whole scene can turn.

export type Shape3D = {
  shape?: string
  text?: string
  color?: string
  x?: number
  y?: number
  z?: number
  size?: number
  metalness?: number
  roughness?: number
  spin?: number
}

const kFont = "/fonts/geist-bold.typeface.json"

function geometryOf(shape: string | undefined): THREE.BufferGeometry {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(0.5, 48, 32)
    case "torus":
      return new THREE.TorusGeometry(0.4, 0.15, 32, 96)
    case "cone":
      return new THREE.ConeGeometry(0.5, 1, 48)
    case "cylinder":
      return new THREE.CylinderGeometry(0.45, 0.45, 1, 48)
    case "knot":
      return new THREE.TorusKnotGeometry(0.35, 0.12, 160, 24)
    case "capsule":
      return new THREE.CapsuleGeometry(0.3, 0.5, 8, 24)
    default:
      return new THREE.BoxGeometry(0.8, 0.8, 0.8)
  }
}

function TextShape({ text }: { text: string }) {
  const font = useLoader(FontLoader, kFont)
  const geometry = React.useMemo(() => {
    const made = new TextGeometry(text || " ", { font, size: 0.5, depth: 0.15, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3 })
    made.center()
    return made
  }, [font, text])
  React.useEffect(() => () => geometry.dispose(), [geometry])
  return <primitive object={geometry} attach="geometry" />
}

function ShapeMesh({ item, index, float, shadows }: { item: Shape3D; index: number; float: boolean; shadows: boolean }) {
  const mesh = React.useRef<THREE.Mesh>(null)
  const color = useCssColor(item.color, "#6366f1")
  const time = useSceneTime()
  const geometry = React.useMemo(() => (item.shape === "text" ? null : geometryOf(item.shape)), [item.shape])
  React.useEffect(() => () => geometry?.dispose(), [geometry])
  const y = item.y ?? 0
  useFrame((state) => {
    const at = time(state)
    if (!mesh.current) return
    mesh.current.rotation.y = spinAt(item.spin ?? 0, at)
    mesh.current.rotation.x = spinAt((item.spin ?? 0) / 2, at)
    mesh.current.position.y = y + (float ? Math.sin(at * 1.2 + index) * 0.08 : 0)
  })
  return (
    <mesh ref={mesh} position={[item.x ?? 0, y, item.z ?? 0]} scale={item.size ?? 1} castShadow={shadows} receiveShadow={shadows} geometry={geometry ?? undefined}>
      {item.shape === "text" && <TextShape text={item.text ?? "Hello"} />}
      <meshStandardMaterial color={color} metalness={item.metalness ?? 0.2} roughness={item.roughness ?? 0.4} />
    </mesh>
  )
}

function Shapes({ shapes, float, autoRotate, speed, shadows }: { shapes: Shape3D[]; float: boolean; autoRotate: boolean; speed: number; shadows: boolean }) {
  const group = React.useRef<THREE.Group>(null)
  const time = useSceneTime()
  useFrame((state) => {
    if (group.current) group.current.rotation.y = autoRotate ? spinAt(speed, time(state)) : 0
  })
  return (
    <group ref={group}>
      {shapes.map((item, index) => (
        <ShapeMesh key={`${index}:${item.shape}`} item={item} index={index} float={float} shadows={shadows} />
      ))}
    </group>
  )
}

function ShapeScene({
  shapes = [],
  lights,
  float = true,
  autoRotate = false,
  speed = 4,
  shadows = true,
  floorColor = "",
  cameraX = 0,
  cameraY = 1.4,
  cameraZ = 5.2,
  ...props
}: Omit<Stage3DProps, "camera"> & {
  shapes?: Shape3D[]
  lights?: Light3D[]
  float?: boolean
  autoRotate?: boolean
  speed?: number
  floorColor?: string
  cameraX?: number
  cameraY?: number
  cameraZ?: number
}) {
  const floor = useCssColor(floorColor, "#ffffff")
  const lowest = Math.min(0, ...shapes.map((item) => (item.y ?? 0) - (item.size ?? 1) * 0.5)) - 0.15
  return (
    <Stage3D slot="shape-scene" camera={[cameraX, cameraY, cameraZ]} shadows={shadows} {...props}>
      <Lights lights={lights} shadows={shadows} />
      <React.Suspense fallback={<Loading />}>
        <Shapes shapes={shapes} float={float} autoRotate={autoRotate} speed={speed} shadows={shadows} />
      </React.Suspense>
      {floorColor ? (
        <mesh rotation-x={-Math.PI / 2} position-y={lowest} receiveShadow={shadows}>
          <circleGeometry args={[6, 64]} />
          <meshStandardMaterial color={floor} roughness={0.9} />
        </mesh>
      ) : (
        shadows && <ShadowFloor y={lowest} />
      )}
    </Stage3D>
  )
}

export { ShapeScene }
