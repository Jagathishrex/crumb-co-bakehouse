import * as React from "react"
import * as THREE from "three"
import { useFrame, useLoader } from "@react-three/fiber"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { Lights, Loading, ShadowFloor, Stage3D, spinAt, useCssColor, useSceneTime, type Environment3D, type Light3D, type Stage3DProps } from "@/components/ui/scene-3d"

// A 3D model (a .glb or .gltf in public/models), fitted to the view, that turns on its own and can be dragged around.
// Its own materials, or one colour with metalness and roughness for all of it.

export type ModelProps = {
  src: string
  material?: "original" | "custom"
  color?: string
  metalness?: number
  roughness?: number
  autoRotate?: boolean
  speed?: number
  shadows?: boolean
  /** A floor that catches its shadow (off when it stands on something else). */
  floor?: boolean
  /** Standing at y = -1 instead of centred. */
  sit?: boolean
}

/** The model, centred and scaled to fit a 2-unit box, turning at `speed` turns a minute. */
export function Model({ src, material = "original", color = "#6366f1", metalness = 0.3, roughness = 0.4, autoRotate = true, speed = 6, shadows = true, floor: withFloor = true, sit = false }: ModelProps) {
  const gltf = useLoader(GLTFLoader, src)
  const tint = useCssColor(color, "#6366f1")
  const turn = React.useRef<THREE.Group>(null)
  const time = useSceneTime()
  const { object, floor } = React.useMemo(() => {
    const copy = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(copy)
    const size = box.getSize(new THREE.Vector3())
    const scale = 2 / Math.max(size.x, size.y, size.z, 0.001)
    copy.position.sub(box.getCenter(new THREE.Vector3())).multiplyScalar(scale)
    copy.scale.multiplyScalar(scale)
    const bottom = (-size.y * scale) / 2
    if (sit) copy.position.y += -1 - bottom
    return { object: copy, floor: (sit ? -1 : bottom) - 0.01 }
  }, [gltf, sit])
  React.useEffect(() => {
    const custom = material === "custom" ? new THREE.MeshStandardMaterial({ color: tint, metalness, roughness }) : null
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      node.castShadow = shadows
      node.userData.material ??= node.material
      node.material = custom ?? node.userData.material
    })
    return () => custom?.dispose()
  }, [object, material, tint, metalness, roughness, shadows])
  useFrame((state) => {
    if (turn.current) turn.current.rotation.y = autoRotate ? spinAt(speed, time(state)) : 0
  })
  return (
    <>
      <group ref={turn}>
        <primitive object={object} />
      </group>
      {shadows && withFloor && <ShadowFloor y={floor} />}
    </>
  )
}

function ModelViewer({
  src = "/models/headphones.glb",
  material = "original",
  color,
  metalness,
  roughness,
  autoRotate = true,
  speed = 6,
  lights,
  shadows = true,
  cameraX = 2.2,
  cameraY = 1.3,
  cameraZ = 3.4,
  ...props
}: Omit<Stage3DProps, "camera"> &
  Partial<ModelProps> & {
    lights?: Light3D[]
    cameraX?: number
    cameraY?: number
    cameraZ?: number
    environment?: Environment3D
  }) {
  return (
    <Stage3D slot="model-viewer" camera={[cameraX, cameraY, cameraZ]} shadows={shadows} resetKey={src} {...props}>
      <Lights lights={lights} shadows={shadows} />
      <React.Suspense fallback={<Loading />}>
        <Model src={src} material={material} color={color} metalness={metalness} roughness={roughness} autoRotate={autoRotate} speed={speed} shadows={shadows} />
      </React.Suspense>
    </Stage3D>
  )
}

export { ModelViewer }
