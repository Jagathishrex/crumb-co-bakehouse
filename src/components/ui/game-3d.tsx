import * as React from "react"
import * as THREE from "three"
import { useFrame, useLoader, useThree, type RootState } from "@react-three/fiber"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { Lights, Loading, Stage3D, useCssColor, type Environment3D, type Light3D, type Stage3DProps } from "@/components/ui/scene-3d"
import { cn } from "cn"

// Games with Three.js: one loop that moves the game, input (keys, gamepad, mouse-look), sounds, and a stage that fills
// the screen. On Kalai's canvas a game rests on its first frame; it plays in Preview, Play mode and the running app,
// and plays itself in a video (useDemo). The scene is data, so Kalai's Scene mode can edit it.

/** Kalai's switch (window.__kalai3d, see scene-3d.tsx): still on the canvas, a set time in video export. */
type KalaiSwitch = { still: boolean; time: number | null; listeners: Set<() => void> }

function kalai(): KalaiSwitch | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { __kalai3d?: KalaiSwitch }).__kalai3d
}

function playingNow(): boolean {
  const at = kalai()
  return !at || (!at.still && at.time == null)
}

function useKalai<T>(read: () => T, server: T): T {
  return React.useSyncExternalStore(
    (change) => {
      const listeners = kalai()?.listeners
      listeners?.add(change)
      return () => listeners?.delete(change)
    },
    read,
    () => server
  )
}

/** Whether the game may run: false while Kalai shows it at rest on the canvas (or exports a video). */
export function usePlaying(): boolean {
  return useKalai(playingNow, false)
}

/** True while Kalai exports a video: no one is playing, so the game starts and steers itself (a demo). */
export function useDemo(): boolean {
  return useKalai(() => kalai()?.time != null, false)
}

/** The longest step one frame may take, so a slow frame or a tab coming back never jumps the game ahead. */
const kMaxStep = 1 / 20

/** The game's one loop: `step` runs every frame with the seconds since the last; at rest not at all; in a video on its clock. */
export function useGameLoop(step: (delta: number, state: RootState) => void): void {
  const latest = React.useRef(step)
  const videoTime = React.useRef<number | null>(null)
  React.useLayoutEffect(() => void (latest.current = step))
  useFrame((state, delta) => {
    const time = kalai()?.time
    if (time != null) {
      const elapsed = videoTime.current === null ? 0 : time - videoTime.current
      videoTime.current = time
      // Several steps for a slow video frame rate, so the game moves as it would live.
      for (let left = elapsed; left > 1e-6; left -= kMaxStep) latest.current(Math.min(left, kMaxStep), state)
      return
    }
    videoTime.current = null
    if (playingNow()) latest.current(Math.min(delta, kMaxStep), state)
  })
}

/** Keys a game uses that would otherwise scroll the page. */
const kGameKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "])

/** A gamepad's sticks, pad and buttons as the keys they stand for. */
function gamepadKeys(gamepad: Gamepad): Set<string> {
  const keys = new Set<string>()
  const [x = 0, y = 0] = gamepad.axes
  const pressed = (button: number) => !!gamepad.buttons[button]?.pressed
  if (x < -0.5 || pressed(14)) keys.add("ArrowLeft")
  if (x > 0.5 || pressed(15)) keys.add("ArrowRight")
  if (y < -0.5 || pressed(12)) keys.add("ArrowUp")
  if (y > 0.5 || pressed(13)) keys.add("ArrowDown")
  if (pressed(0) || pressed(1)) keys.add(" ")
  if (pressed(9)) keys.add("Enter")
  return keys
}

/**
 * The keys held down now (event.key: "ArrowLeft", " ", "a"), in a ref to read in useGameLoop, never in render. A
 * gamepad counts too (stick and pad as arrows, A as Space, Start as Enter). `onPress` hears each new press.
 */
export function useKeys(onPress?: (key: string) => void): React.RefObject<Set<string>> {
  const held = React.useRef(new Set<string>())
  const latest = React.useRef(onPress)
  React.useLayoutEffect(() => void (latest.current = onPress))
  React.useEffect(() => {
    const typing = (event: KeyboardEvent) => event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
    const down = (event: KeyboardEvent) => {
      if (typing(event) || event.metaKey || event.ctrlKey || !playingNow()) return
      if (kGameKeys.has(event.key)) event.preventDefault()
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (!event.repeat) latest.current?.(key)
      held.current.add(key)
    }
    const up = (event: KeyboardEvent) => held.current.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key)
    const clear = () => held.current.clear()
    // A gamepad is read each frame, only once one is connected.
    let frame = 0
    let padKeys = new Set<string>()
    const poll = () => {
      frame = requestAnimationFrame(poll)
      const gamepad = navigator.getGamepads?.().find((pad) => !!pad)
      const now = gamepad && playingNow() ? gamepadKeys(gamepad) : new Set<string>()
      for (const key of now) if (!padKeys.has(key)) (latest.current?.(key), held.current.add(key))
      for (const key of padKeys) if (!now.has(key)) held.current.delete(key)
      padKeys = now
    }
    const connected = () => void (frame ||= requestAnimationFrame(poll))
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    window.addEventListener("gamepadconnected", connected)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
      window.removeEventListener("gamepadconnected", connected)
    }
  }, [])
  return held
}

/** Mouse-look: a click on the game locks the pointer, and `moved.current` adds up its moves ({ x, y } in pixels); zero it after reading. Esc lets go. */
export function usePointerLook(): React.RefObject<{ x: number; y: number }> {
  const moved = React.useRef({ x: 0, y: 0 })
  React.useEffect(() => {
    const click = (event: MouseEvent) => {
      if (playingNow() && !document.pointerLockElement && event.target instanceof HTMLCanvasElement) void Promise.resolve(event.target.requestPointerLock?.()).catch(() => {})
    }
    const move = (event: MouseEvent) => {
      if (!document.pointerLockElement) return
      moved.current.x += event.movementX
      moved.current.y += event.movementY
    }
    window.addEventListener("click", click)
    window.addEventListener("mousemove", move)
    return () => {
      window.removeEventListener("click", click)
      window.removeEventListener("mousemove", move)
    }
  }, [])
  return moved
}

let tones: AudioContext | null = null

/** A short tone for a game sound (a jump, a coin), made in the browser; silent at rest and in videos. */
export function playTone(frequency = 660, seconds = 0.12, wave: OscillatorType = "square", volume = 0.12): void {
  if (typeof window === "undefined" || !playingNow()) return
  tones ??= new AudioContext()
  const oscillator = tones.createOscillator()
  const gain = tones.createGain()
  oscillator.type = wave
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(volume, tones.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, tones.currentTime + seconds)
  oscillator.connect(gain).connect(tones.destination)
  oscillator.start()
  oscillator.stop(tones.currentTime + seconds)
}

/** A sound file from public/audio ("/audio/coin.mp3"): call what it returns to play it (several may overlap). */
export function useSound(src: string, volume = 0.7): () => void {
  return React.useCallback(() => {
    if (!playingNow()) return
    const audio = new Audio(src)
    audio.volume = volume
    void audio.play().catch(() => {})
  }, [src, volume])
}

/** Full screen for the game's screen (or leaves it); in Kalai's Preview the screen's frame fills the display. */
export function toggleFullscreen(element: Element | null = document.documentElement): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  else void element?.requestFullscreen?.().catch(() => {})
}

/** One object of the level: what it is, where, how it looks and what it does in the game. Angles in degrees. */
export type LevelItem = {
  name: string
  group?: string
  /** A shape, or "model": the .glb at src (public/models), fitted into a 1×1×1 box (standing on its floor) before its size. */
  shape?: "box" | "sphere" | "cylinder" | "cone" | "coin" | "model"
  src?: string
  role?: "player" | "obstacle" | "pickup" | "platform" | "enemy" | "goal" | "scenery"
  x?: number
  y?: number
  z?: number
  rx?: number
  ry?: number
  rz?: number
  sx?: number
  sy?: number
  sz?: number
  color?: string
  metalness?: number
  roughness?: number
  hidden?: boolean
  /** While playing: "dynamic" falls, bounces and is pushed; "fixed" is solid (real physics, game-physics.tsx). */
  physics?: "dynamic" | "fixed"
}

type Level = { items: LevelItem[]; objects: React.RefObject<(THREE.Object3D | null)[]> }

const LevelContext = React.createContext<Level>({ items: [], objects: { current: [] } })

/** The level's objects and their three.js objects (by the item's index), to move them in the game loop. */
export function useLevel(): Level {
  return React.useContext(LevelContext)
}

const kDegrees = Math.PI / 180

/**
 * A .glb fitted into a 1×1×1 box, so its size works as a shape's does: centred across, standing on the box's floor,
 * so pieces of one kit (a road and a corner with a tall barrier) meet at the same ground.
 */
function Model({ src }: { src: string }) {
  const gltf = useLoader(GLTFLoader, src)
  const model = React.useMemo(() => {
    const copy = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(copy)
    const size = box.getSize(new THREE.Vector3())
    const fit = 1 / Math.max(size.x, size.y, size.z, 1e-6)
    copy.scale.setScalar(fit)
    const middle = box.getCenter(new THREE.Vector3())
    copy.position.set(-middle.x * fit, -box.min.y * fit - 0.5, -middle.z * fit)
    copy.traverse((part) => {
      if ((part as THREE.Mesh).isMesh) part.castShadow = part.receiveShadow = true
    })
    return copy
  }, [gltf])
  return <primitive object={model} />
}

/** One level row drawn; inside a physics body (`placed` false) the body holds its place and turn. */
export function LevelObject({ item, index, objects, placed = true }: { item: LevelItem; index: number; objects: Level["objects"]; placed?: boolean }) {
  const color = useCssColor(item.color, "#a1a1aa")
  const shape = item.shape ?? "box"
  return (
    <group
      ref={(group) => void (objects.current[index] = group)}
      userData={{ kalaiItem: index }}
      visible={!item.hidden}
      position={placed ? [item.x ?? 0, item.y ?? 0, item.z ?? 0] : [0, 0, 0]}
      rotation={placed ? [(item.rx ?? 0) * kDegrees, (item.ry ?? 0) * kDegrees, (item.rz ?? 0) * kDegrees] : [0, 0, 0]}
      scale={[item.sx ?? 1, item.sy ?? 1, item.sz ?? 1]}
    >
      {shape === "model" && item.src ? (
        <React.Suspense fallback={<Loading />}>
          <Model src={item.src} />
        </React.Suspense>
      ) : (
        <mesh castShadow={(item.sy ?? 1) > 0.1} receiveShadow rotation-x={shape === "coin" ? Math.PI / 2 : 0}>
          {shape === "sphere" ? <sphereGeometry args={[0.5, 32, 16]} /> : shape === "cylinder" || shape === "coin" ? <cylinderGeometry args={[0.5, 0.5, 1, 32]} /> : shape === "cone" ? <coneGeometry args={[0.5, 1, 32]} /> : <boxGeometry />}
          <meshStandardMaterial color={color} metalness={item.metalness ?? 0} roughness={item.roughness ?? 0.5} />
        </mesh>
      )}
    </group>
  )
}

type DragTool = "move" | "rotate" | "scale"
type Axis = "x" | "y" | "z" | "ring"

const kAxisColors = { x: "#ef4444", y: "#22c55e", z: "#3b82f6" } as const

/** Handles drawn on the picked object: an arrow per axis (cone tips to move, cube tips to size) and a ring to turn. */
function makeHandles(): THREE.Group {
  const group = new THREE.Group()
  const material = (color: string) => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.95 })
  for (const axis of ["x", "y", "z"] as const) {
    const arrow = new THREE.Group()
    arrow.name = axis
    // Arrows start away from the middle, so a press on the object itself still drags it freely.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), material(kAxisColors[axis]))
    shaft.position.y = 0.775
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 16), material(kAxisColors[axis]))
    cone.position.y = 1.1
    cone.name = "move"
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material(kAxisColors[axis]))
    cube.position.y = 1.05
    cube.name = "scale"
    // A wider, unseen grip so the thin arrow is easy to press.
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 8), new THREE.MeshBasicMaterial({ visible: false }))
    grip.position.y = 0.9
    arrow.add(shaft, cone, cube, grip)
    if (axis === "x") arrow.rotation.z = -Math.PI / 2
    if (axis === "z") arrow.rotation.x = Math.PI / 2
    arrow.traverse((part) => void (part.userData.kalaiAxis = axis))
    group.add(arrow)
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), material("#eab308"))
  ring.rotation.x = Math.PI / 2
  ring.name = "ring"
  const ringGrip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 6, 48), new THREE.MeshBasicMaterial({ visible: false }))
  ringGrip.rotation.x = Math.PI / 2
  ringGrip.name = "ring"
  ring.userData.kalaiAxis = ringGrip.userData.kalaiAxis = "ring"
  group.add(ring, ringGrip)
  group.traverse((part) => void (part.renderOrder = 1000))
  group.visible = false
  return group
}
type Dragged = { index: number; position: THREE.Vector3; rotationY: number; scale: THREE.Vector3; until: number }
type Placed = { x: number; y: number; z: number; ry: number; sx: number; sy: number; sz: number }

const round = (value: number, step: number) => Math.round(value / step) * step
const tidy = (value: number) => Math.round(value * 100) / 100

/**
 * Kalai's Scene mode (window.__kalaiGame): which object is under a point, the picked one outlined, objects dragged
 * (moved, turned, sized) and the view looked at from the game's camera, from above, or turned around freely.
 * It runs last and draws the frame itself (priority 1), so what Scene mode shows wins over the game's own frame code.
 */
function ScenePicker({ items, objects }: { items: LevelItem[]; objects: Level["objects"] }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const scene = useThree((state) => state.scene)
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const picked = React.useRef<number | null>(null)
  const tool = React.useRef<DragTool>("move")
  const dragged = React.useRef<Dragged | null>(null)
  const view = React.useRef<{ mode: "game" | "top" | "free"; yaw: number; pitch: number; distance: number; saved: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null }>({ mode: "game", yaw: 0, pitch: 0.5, distance: 14, saved: null })
  const latestItems = React.useRef(items)
  React.useLayoutEffect(() => void (latestItems.current = items))
  // The picked object: a blue tinted box with blue edges, drawn over everything so it shows behind other objects too.
  const outline = React.useMemo(() => {
    const group = new THREE.Group()
    const box = new THREE.BoxGeometry(1, 1, 1)
    group.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: "#0d6efd", transparent: true, opacity: 0.28, depthTest: false, depthWrite: false, fog: false })))
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: "#0d6efd", depthTest: false, fog: false })))
    group.renderOrder = 999
    group.children.forEach((child) => (child.renderOrder = 999))
    group.visible = false
    return group
  }, [])
  const handles = React.useMemo(() => makeHandles(), [])
  const bounds = React.useMemo(() => new THREE.Box3(), [])
  React.useEffect(() => {
    scene.add(outline, handles)
    const ray = new THREE.Raycaster()
    const aim = (x: number, y: number) => {
      const box = element.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1), camera)
      return ray
    }
    let start: { index: number; tool: DragTool; axis: Axis | null; x: number; y: number; position: THREE.Vector3; rotationY: number; scale: THREE.Vector3; plane: THREE.Plane; hit: THREE.Vector3 | null } | null = null
    const placed = (): Placed | null => {
      const now = dragged.current
      if (!now) return null
      return { x: tidy(now.position.x), y: tidy(now.position.y), z: tidy(now.position.z), ry: tidy(now.rotationY / kDegrees), sx: tidy(now.scale.x), sy: tidy(now.scale.y), sz: tidy(now.scale.z) }
    }
    const game = {
      pick(x: number, y: number): number | null {
        for (const hit of aim(x, y).intersectObjects(objects.current.filter((object): object is THREE.Object3D => !!object?.visible), true)) {
          let at: THREE.Object3D | null = hit.object
          while (at && at.userData.kalaiItem === undefined) at = at.parent
          if (at) return at.userData.kalaiItem as number
        }
        return null
      },
      /** A handle of the picked object under a point: its axis (or the ring), or null. */
      handleAt(x: number, y: number): { index: number; axis: Axis } | null {
        if (!handles.visible || picked.current === null) return null
        for (const hit of aim(x, y).intersectObject(handles, true)) {
          if (!hit.object.parent?.visible && hit.object.parent !== handles) continue
          const axis = hit.object.userData.kalaiAxis as Axis | undefined
          if (axis && (axis === "ring" ? tool.current === "rotate" : tool.current !== "rotate")) return { index: picked.current, axis }
        }
        return null
      },
      outline(index: number | null, using?: DragTool) {
        picked.current = index
        if (using) tool.current = using
        invalidate()
      },
      /** A drag on a picked object: start, then moves, then end, which gives its new place to write into the level. */
      drag(phase: "start" | "move" | "end", x: number, y: number, options: { index?: number; tool?: DragTool; axis?: Axis | null; snap?: boolean; vertical?: boolean } = {}): Placed | null {
        if (phase === "start") {
          const object = options.index === undefined ? null : objects.current[options.index]
          if (!object) return null
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.position.y)
          start = { index: options.index!, tool: options.tool ?? "move", axis: options.axis ?? null, x, y, position: object.position.clone(), rotationY: object.rotation.y, scale: object.scale.clone(), plane, hit: aim(x, y).ray.intersectPlane(plane, new THREE.Vector3()) }
          dragged.current = { index: start.index, position: start.position.clone(), rotationY: start.rotationY, scale: start.scale.clone(), until: Infinity }
          return placed()
        }
        const now = dragged.current
        if (!start || !now) return null
        if (start.tool === "move" && (options.vertical || start.axis === "y")) {
          // Up and down: as far as the pointer moved, in the units at the object's distance.
          const perPixel = (2 * camera.position.distanceTo(start.position) * Math.tan((camera.fov * kDegrees) / 2)) / Math.max(1, element.clientHeight)
          now.position.copy(start.position)
          now.position.y = start.position.y + (start.y - y) * perPixel
          if (options.snap) now.position.y = round(now.position.y, 0.5)
        } else if (start.tool === "move") {
          const hit = aim(x, y).ray.intersectPlane(start.plane, new THREE.Vector3())
          if (hit && start.hit) {
            // On an arrow it moves along that axis only.
            now.position.set(start.position.x + (start.axis === "z" ? 0 : hit.x - start.hit.x), start.position.y, start.position.z + (start.axis === "x" ? 0 : hit.z - start.hit.z))
            if (options.snap) now.position.set(round(now.position.x, 0.5), now.position.y, round(now.position.z, 0.5))
          }
        } else if (start.tool === "rotate") {
          now.rotationY = start.rotationY + (x - start.x) * 0.01
          if (options.snap) now.rotationY = round(now.rotationY, 15 * kDegrees)
        } else {
          const raw = Math.max(0.05, 1 + (start.y - y + (start.axis && start.axis !== "y" ? x - start.x : 0)) * 0.005)
          const factor = options.snap ? round(raw, 0.1) || 0.1 : raw
          // On an arrow it sizes along that axis only.
          now.scale.copy(start.scale)
          if (start.axis === "x" || start.axis === "y" || start.axis === "z") now.scale[start.axis] = start.scale[start.axis] * factor
          else now.scale.multiplyScalar(factor)
        }
        invalidate()
        if (phase === "end") {
          const result = placed()
          // It stays where it was let go until the level says so (the file is written and drawn again).
          now.until = performance.now() + 3000
          start = null
          return result
        }
        return placed()
      },
      /** The view in Scene mode; "game" puts the game's own camera back. `turn` and `zoom` move the free view. */
      view(mode: "game" | "top" | "free", turn?: { x: number; y: number; zoom?: number }) {
        const state = view.current
        if (state.mode === "game" && mode !== "game") state.saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone() }
        if (mode === "free" && state.mode !== "free") {
          const from = state.saved?.position ?? camera.position
          state.distance = Math.max(4, from.length())
          state.yaw = Math.atan2(from.x, from.z)
          state.pitch = Math.asin(Math.min(1, Math.max(-1, from.y / state.distance)))
        }
        if (turn) {
          state.yaw -= turn.x * 0.006
          state.pitch = Math.min(1.5, Math.max(0.05, state.pitch + turn.y * 0.006))
          state.distance = Math.min(200, Math.max(3, state.distance * (turn.zoom ?? 1)))
        }
        if (mode === "game" && state.mode !== "game" && state.saved) {
          camera.position.copy(state.saved.position)
          camera.quaternion.copy(state.saved.quaternion)
        }
        state.mode = mode
        invalidate()
      },
      /** Where a level object is drawn now (in the world) and its middle on screen, and a handle of the picked one on screen (for checks). */
      positionOf(index: number): { x: number; y: number; z: number } | null {
        const point = objects.current[index]?.getWorldPosition(new THREE.Vector3())
        return point ? { x: tidy(point.x), y: tidy(point.y), z: tidy(point.z) } : null
      },
      pointOf(index: number): { x: number; y: number } | null {
        const object = objects.current[index]
        if (!object) return null
        const middle = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera)
        const box = element.getBoundingClientRect()
        return { x: box.left + ((middle.x + 1) / 2) * box.width, y: box.top + ((1 - middle.y) / 2) * box.height }
      },
      handlePoint(axis: "x" | "y" | "z"): { x: number; y: number } | null {
        const arrow = handles.children.find((part) => part.name === axis)
        if (!handles.visible || !arrow) return null
        const tip = new THREE.Vector3(0, 1.0, 0).applyMatrix4(arrow.matrixWorld).project(camera)
        const box = element.getBoundingClientRect()
        return { x: box.left + ((tip.x + 1) / 2) * box.width, y: box.top + ((1 - tip.y) / 2) * box.height }
      },
      /** Where the camera is now, to keep a view as the game's camera (it looks at the middle, 0 0 0). */
      cameraNow(): { x: number; y: number; z: number } {
        return { x: tidy(camera.position.x), y: tidy(camera.position.y), z: tidy(camera.position.z) }
      },
    }
    ;(window as unknown as { __kalaiGame?: typeof game }).__kalaiGame = game
    // Kalai picks, outlines and views again once the game is there (a screen that loads or reloads in Scene mode).
    window.dispatchEvent(new Event("kalai:game-ready"))
    return () => {
      scene.remove(outline, handles)
      delete (window as unknown as { __kalaiGame?: typeof game }).__kalaiGame
    }
  }, [scene, outline, handles, element, camera, objects, invalidate])
  useFrame((state) => {
    // A dragged object is shown where it is dragged to, until the level has its new place.
    const now = dragged.current
    if (now) {
      const item = latestItems.current[now.index]
      const written = item && Math.abs((item.x ?? 0) - now.position.x) < 0.01 && Math.abs((item.z ?? 0) - now.position.z) < 0.01 && Math.abs((item.y ?? 0) - now.position.y) < 0.01 && Math.abs((item.ry ?? 0) * kDegrees - now.rotationY) < 0.01 && Math.abs((item.sx ?? 1) - now.scale.x) < 0.01 && Math.abs((item.sy ?? 1) - now.scale.y) < 0.01 && Math.abs((item.sz ?? 1) - now.scale.z) < 0.01
      // While the pointer is down (until is Infinity) it always shows where it is dragged to.
      if (now.until !== Infinity && (written || performance.now() > now.until)) dragged.current = null
      else {
        const object = objects.current[now.index]
        object?.position.copy(now.position)
        if (object) object.rotation.y = now.rotationY
        object?.scale.copy(now.scale)
      }
    }
    const look = view.current
    if (look.mode === "top") {
      camera.position.set(0, 45, 0.001)
      camera.lookAt(0, 0, 0)
    } else if (look.mode === "free") {
      camera.position.set(look.distance * Math.cos(look.pitch) * Math.sin(look.yaw), look.distance * Math.sin(look.pitch), look.distance * Math.cos(look.pitch) * Math.cos(look.yaw))
      camera.lookAt(0, 0, 0)
    }
    const object = picked.current === null ? null : objects.current[picked.current]
    outline.visible = !!object && object.visible && !playingNow()
    handles.visible = outline.visible
    if (object && outline.visible) {
      bounds.setFromObject(object)
      bounds.getCenter(outline.position)
      bounds.getSize(outline.scale).multiplyScalar(1.06).addScalar(0.04)
      // The handles keep about the same size on screen, wherever the object is.
      handles.position.copy(outline.position)
      handles.scale.setScalar(Math.max(0.3, camera.position.distanceTo(outline.position) * 0.11))
      for (const arrow of handles.children) {
        arrow.visible = arrow.name === "ring" ? tool.current === "rotate" : arrow.type === "Group" && tool.current !== "rotate"
        for (const tip of arrow.children) if (tip.name === "move" || tip.name === "scale") tip.visible = tip.name === tool.current
      }
    }
    state.gl.render(state.scene, state.camera)
  }, 1)
  return null
}

export type GameStageProps = Omit<Stage3DProps, "camera" | "background"> & {
  level?: LevelItem[]
  lights?: Light3D[]
  cameraX?: number
  cameraY?: number
  cameraZ?: number
  skyTop?: string
  skyBottom?: string
  fogColor?: string
  fogNear?: number
  fogFar?: number
  environment?: Environment3D
  /** Pull down for physics rows, in units a second squared (negative is down). */
  gravity?: number
}

/** Loaded only for a game with physics rows, so other games never need the physics library. */
const GamePhysics = React.lazy(() => import("@/components/ui/game-physics"))

/** The game's 3D stage: the level, lights, camera, sky and fog from its props; marked so Kalai's Preview hands it the keyboard. */
export function GameStage({ level = [], lights, cameraX = 0, cameraY = 3, cameraZ = 8, skyTop = "", skyBottom = "", fogColor = "", fogNear = 20, fogFar = 70, environment = "soft", gravity = -9.81, className, style, children, ...props }: GameStageProps) {
  const objects = React.useRef<(THREE.Object3D | null)[]>([])
  const playing = usePlaying()
  // Physics runs only while playing: at rest (and in Scene mode) the level is exactly as written.
  const physical = playing && level.some((item) => item.physics)
  const fog = useCssColor(fogColor, "#ffffff")
  const value = React.useMemo(() => ({ items: level, objects }), [level])
  const sky = skyTop || skyBottom ? { background: `linear-gradient(${skyTop || skyBottom}, ${skyBottom || skyTop})` } : undefined
  return (
    <Stage3D slot="game-3d" data-kalai-game="" orbit={false} camera={[cameraX, cameraY, cameraZ]} environment={environment} className={cn("absolute inset-0 size-full rounded-none", className)} style={{ ...sky, ...style }} {...props}>
      <LevelContext value={value}>
        {fogColor && <fog attach="fog" args={[fog, fogNear, fogFar]} />}
        {lights && <Lights lights={lights} />}
        {physical ? (
          <React.Suspense fallback={null}>
            <GamePhysics level={level} objects={objects} gravity={gravity}>
              {children}
            </GamePhysics>
          </React.Suspense>
        ) : (
          <>
            {level.map((item, index) => (
              <LevelObject key={index} item={item} index={index} objects={objects} />
            ))}
            {children}
          </>
        )}
        <ScenePicker items={level} objects={objects} />
      </LevelContext>
    </Stage3D>
  )
}
