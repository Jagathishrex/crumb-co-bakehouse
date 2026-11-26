import * as React from "react"
import { Model, type ModelProps } from "@/components/ui/model-viewer"
import { Lights, Loading, Stage3D, useCssColor, type Light3D, type Stage3DProps } from "@/components/ui/scene-3d"

// A product on a turntable: the model turns slowly on a round podium with a soft shadow, and can be dragged around
// (sideways only), as on a shop's product page.

function Podium({ color, shadows }: { color: string; shadows: boolean }) {
  const fill = useCssColor(color, "#ffffff")
  return (
    <mesh position-y={-1.04} receiveShadow={shadows} castShadow={shadows}>
      <cylinderGeometry args={[1.15, 1.15, 0.08, 96]} />
      <meshStandardMaterial color={fill} roughness={0.35} metalness={0} />
    </mesh>
  )
}

function ProductSpin({
  src = "/models/headphones.glb",
  material = "original",
  color,
  metalness,
  roughness,
  speed = 8,
  dragToSpin = true,
  podium = true,
  podiumColor = "#ffffff",
  lights,
  shadows = true,
  cameraHeight = 0.9,
  cameraDistance = 4.4,
  ...props
}: Omit<Stage3DProps, "camera" | "orbit" | "orbitVertical"> &
  Partial<ModelProps> & {
    dragToSpin?: boolean
    podium?: boolean
    podiumColor?: string
    lights?: Light3D[]
    cameraHeight?: number
    cameraDistance?: number
  }) {
  return (
    <Stage3D slot="product-spin" camera={[0, cameraHeight, cameraDistance]} orbit={dragToSpin} orbitVertical={false} shadows={shadows} resetKey={src} {...props}>
      <Lights lights={lights} shadows={shadows} />
      <React.Suspense fallback={<Loading />}>
        <Model src={src} material={material} color={color} metalness={metalness} roughness={roughness} autoRotate speed={speed} shadows={shadows} floor={!podium} sit />
      </React.Suspense>
      {podium && <Podium color={podiumColor} shadows={shadows} />}
    </Stage3D>
  )
}

export { ProductSpin }
