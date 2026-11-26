import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { cn } from "cn"

// What the 3D blocks share (Three.js with React Three Fiber): the stage, lights from rows, environment light, orbit
// controls and one clock. In Kalai the canvas shows a still frame; Play mode and video export move it.

export type Light3D = {
  type?: string
  color?: string
  intensity?: number
  x?: number
  y?: number
  z?: number
  shadow?: boolean
}

export type Environment3D = "none" | "studio" | "soft" | "sunset" | "night"

export const kLights: Light3D[] = [
  { type: "ambient", color: "#ffffff", intensity: 0.6, x: 0, y: 0, z: 0, shadow: false },
  { type: "directional", color: "#ffffff", intensity: 2, x: 3, y: 6, z: 3, shadow: true },
]

/** Kalai's switch (window.__kalai3d): still on the canvas, a set time in video export. Absent in the app itself. */
type KalaiSwitch = { still: boolean; time: number | null; pending: number; listeners: Set<() => void> }

function kalai(): KalaiSwitch | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { __kalai3d?: KalaiSwitch }).__kalai3d
}

function useKalaiMode(): "still" | "timed" | "live" {
  return React.useSyncExternalStore(
    (change) => {
      const listeners = kalai()?.listeners
      listeners?.add(change)
      return () => listeners?.delete(change)
    },
    () => (kalai()?.time != null ? "timed" : kalai()?.still ? "still" : "live"),
    () => "live"
  )
}

const ClockContext = React.createContext<React.RefObject<number>>({ current: 0 })
/** True when the person asked their system for less motion: the scene rests and moves only when dragged. */
const CalmContext = React.createContext(false)

function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (change) => {
      const query = typeof window === "undefined" || !window.matchMedia ? null : window.matchMedia("(prefers-reduced-motion: reduce)")
      query?.addEventListener("change", change)
      return () => query?.removeEventListener("change", change)
    },
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

/** Whether a box is on screen or near it; true until known, and where the browser cannot tell. */
function useOnScreen(box: React.RefObject<HTMLElement | null>): boolean {
  const [shown, setShown] = React.useState(true)
  React.useEffect(() => {
    const element = box.current
    if (!element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => setShown(entry.isIntersecting), { rootMargin: "200px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [box])
  return shown
}

/** Seconds since the scene started moving: 0 at rest, the export's time in a video. */
export function useSceneTime(): (state: RootState) => number {
  const start = React.useContext(ClockContext)
  const calm = React.useContext(CalmContext)
  return React.useCallback((state: RootState) => {
    const at = kalai()
    if (at?.time != null) return at.time
    if (at?.still || calm) return 0
    return state.clock.elapsedTime - start.current
  }, [start, calm])
}

/** Counts a model or font that is still loading, so Kalai's pictures wait for it. */
export function Loading() {
  React.useEffect(() => {
    const at = kalai()
    if (!at) return
    at.pending += 1
    return () => void (at.pending -= 1)
  }, [])
  return null
}

/** Draws a frame when Kalai asks: at rest after a change, or at the export's time. */
function Driver({ start }: { start: React.RefObject<number> }) {
  const advance = useThree((state) => state.advance)
  const invalidate = useThree((state) => state.invalidate)
  const clock = useThree((state) => state.clock)
  React.useEffect(() => {
    const at = kalai()
    if (!at) return
    const draw = () => {
      if (at.time != null) advance(performance.now())
      else if (at.still) invalidate()
      // Moving again starts from the rest pose.
      else start.current = clock.elapsedTime
    }
    at.listeners.add(draw)
    return () => void at.listeners.delete(draw)
  }, [advance, invalidate, clock, start])
  return null
}

/** A CSS colour (hex, a name, or var(--primary) from the theme) as three.js can read it. */
export function useCssColor(value: string | undefined, fallback: string): string {
  const [color, setColor] = React.useState(() => (value && !value.includes("(") ? value : fallback))
  React.useLayoutEffect(() => setColor(resolveColor(value || fallback)), [value, fallback])
  return color
}

let probe: CanvasRenderingContext2D | null = null

export function resolveColor(value: string): string {
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value
  if (typeof document === "undefined") return "#888888"
  // Theme colours are oklch(): a browser canvas turns any CSS colour into RGB.
  const element = document.createElement("span")
  element.style.color = value
  document.body.append(element)
  const computed = getComputedStyle(element).color
  element.remove()
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!probe) return "#888888"
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`
}

export function Lights({ lights = kLights, shadows = true }: { lights?: Light3D[]; shadows?: boolean }) {
  return (
    <>
      {lights.map((light, index) => (
        <Light key={index} light={light} shadows={shadows} />
      ))}
    </>
  )
}

function Light({ light, shadows }: { light: Light3D; shadows: boolean }) {
  const color = useCssColor(light.color, "#ffffff")
  const intensity = light.intensity ?? 1
  const position: [number, number, number] = [light.x ?? 0, light.y ?? 0, light.z ?? 0]
  const cast = shadows && !!light.shadow
  switch (light.type) {
    case "ambient":
      return <ambientLight color={color} intensity={intensity} />
    case "hemisphere":
      return <hemisphereLight args={[color, "#444444", intensity]} position={position} />
    case "point":
      return <pointLight color={color} intensity={intensity * 10} position={position} castShadow={cast} />
    case "spot":
      return <spotLight color={color} intensity={intensity * 20} position={position} angle={0.5} penumbra={0.6} castShadow={cast} />
    default:
      return <directionalLight color={color} intensity={intensity} position={position} castShadow={cast} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6} shadow-blurSamples={16} />
  }
}

/** A gradient sky with a bright panel, rendered once into an environment map. */
function skyScene(top: string, bottom: string, panel: string, strength: number): THREE.Scene {
  const scene = new THREE.Scene()
  const sky = new THREE.SphereGeometry(10, 32, 16)
  const colors: number[] = []
  const high = new THREE.Color(top)
  const low = new THREE.Color(bottom)
  const position = sky.getAttribute("position")
  for (let index = 0; index < position.count; index++) {
    const mix = THREE.MathUtils.clamp(position.getY(index) / 10 * 0.5 + 0.5, 0, 1)
    const color = low.clone().lerp(high, mix)
    colors.push(color.r, color.g, color.b)
  }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })))
  const light = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(panel).multiplyScalar(strength), side: THREE.DoubleSide }))
  light.position.set(-3, 5, 4)
  light.lookAt(0, 0, 0)
  scene.add(light)
  return scene
}

function Environment({ preset }: { preset: Environment3D }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    if (preset === "none") return
    const pmrem = new THREE.PMREMGenerator(gl)
    const source =
      preset === "sunset" ? skyScene("#4c3a78", "#ff9a5a", "#ffd2a1", 6)
      : preset === "night" ? skyScene("#05070f", "#1d2a4a", "#9db4ff", 3)
      : preset === "soft" ? skyScene("#f4f4f5", "#d4d4d8", "#ffffff", 2)
      : new RoomEnvironment()
    const map = pmrem.fromScene(source, 0.04).texture
    scene.environment = map
    invalidate()
    return () => {
      scene.environment = null
      map.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, invalidate, preset])
  return null
}

function Camera({ position, fov }: { position: [number, number, number]; fov: number }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((state) => state.invalidate)
  const [x, y, z] = position
  React.useEffect(() => {
    camera.position.set(x, y, z)
    camera.fov = fov
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, x, y, z, fov, invalidate])
  return null
}

/** Drag to orbit (and scroll to zoom); off while Kalai shows the canvas at rest, where a drag moves the layer. */
function Orbit({ enabled, zoom, vertical }: { enabled: boolean; zoom: boolean; vertical: boolean }) {
  const camera = useThree((state) => state.camera)
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const controls = React.useMemo(() => new OrbitControls(camera, element), [camera, element])
  React.useEffect(() => {
    controls.enabled = enabled
    controls.enableZoom = zoom
    controls.enablePan = false
    controls.enableDamping = true
    if (!vertical) controls.minPolarAngle = controls.maxPolarAngle = camera.position.angleTo(new THREE.Vector3(0, 1, 0))
    const changed = () => invalidate()
    controls.addEventListener("change", changed)
    return () => controls.removeEventListener("change", changed)
  }, [controls, enabled, zoom, vertical, camera, invalidate])
  React.useEffect(() => () => controls.dispose(), [controls])
  useFrame(() => enabled && controls.update())
  return null
}

/** A GPU canvas's most pixels: 2× the screen, 8,192 a side and 16 million in all, so a big 3D background on a 5K screen stays light. */
const kMaxDpr = 2
const kMaxSide = 8192
const kMaxPixels = 16_000_000

function PixelCap() {
  const size = useThree((state) => state.size)
  const setDpr = useThree((state) => state.setDpr)
  React.useEffect(() => {
    const longest = Math.max(1, size.width, size.height)
    setDpr(Math.min(window.devicePixelRatio || 1, kMaxDpr, kMaxSide / longest, Math.sqrt(kMaxPixels / Math.max(1, size.width * size.height))))
  }, [size.width, size.height, setDpr])
  return null
}

/** A floor that only shows the shadows falling on it. */
export function ShadowFloor({ y = -1, opacity = 0.16 }: { y?: number; opacity?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <shadowMaterial transparent opacity={opacity} />
    </mesh>
  )
}

export type Stage3DProps = Omit<React.ComponentProps<"div">, "children"> & {
  camera?: [number, number, number]
  fov?: number
  background?: string
  environment?: Environment3D
  exposure?: number
  shadows?: boolean
  orbit?: boolean
  zoom?: boolean
  /** Orbit up and down too, not only around. */
  orbitVertical?: boolean
  slot?: string
  /** A change (a new model) clears a failed load's message. */
  resetKey?: string
  children?: React.ReactNode
}

/** A sized box with a WebGL canvas: camera, background, environment light and orbit controls. */
export function Stage3D({
  camera = [3, 2, 5],
  fov = 40,
  background = "",
  environment = "studio",
  exposure = 1,
  shadows = true,
  orbit = true,
  zoom = false,
  orbitVertical = true,
  slot = "scene-3d",
  resetKey,
  className,
  children,
  ...props
}: Stage3DProps) {
  const mode = useKalaiMode()
  const start = React.useRef(0)
  const box = React.useRef<HTMLDivElement>(null)
  const shown = useOnScreen(box)
  const calm = useReducedMotion()
  const backgroundColor = useCssColor(background, "#ffffff")
  // Off screen it stops drawing; with less motion asked for it draws only when something changes (a drag, a resize).
  const frameloop = mode === "timed" ? "never" : mode === "still" || calm ? "demand" : shown ? "always" : "never"
  return (
    <div ref={box} data-slot={slot} className={cn("relative h-80 w-[480px] overflow-hidden rounded-xl", className)} {...props}>
      <Problem key={resetKey}>
      <ClockContext value={start}>
      <CalmContext value={calm}>
        <Canvas
          frameloop={frameloop}
          // Soft PCF shadows were removed from three.js: plain PCF.
          shadows={shadows ? "percentage" : false}
          dpr={[1, 2]}
          camera={{ position: camera, fov }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMappingExposure: exposure }}
          onCreated={({ gl }) => void (gl.toneMappingExposure = exposure)}
          className="size-full"
        >
          <Driver start={start} />
          <PixelCap />
          <Camera position={camera} fov={fov} />
          <Exposure value={exposure} />
          {background && <color attach="background" args={[backgroundColor]} />}
          <Environment preset={environment} />
          <Orbit enabled={orbit && mode === "live"} zoom={zoom} vertical={orbitVertical} />
          {children}
        </Canvas>
      </CalmContext>
      </ClockContext>
      </Problem>
    </div>
  )
}

/** A model or font that fails to load shows why, in place of the scene. */
class Problem extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return <p className="flex size-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{this.state.error}</p>
  }
}

function Exposure({ value }: { value: number }) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    gl.toneMappingExposure = value
    invalidate()
  }, [gl, value, invalidate])
  return null
}

/** Turns per minute as radians at a time. */
export function spinAt(turnsPerMinute: number, seconds: number): number {
  return (turnsPerMinute / 60) * seconds * Math.PI * 2
}
