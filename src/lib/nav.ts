import { createElement, useEffect, useRef, type ComponentType, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

// Screen-to-screen navigation through the URL hash (#/Pricing), with Figma-style transitions run by the
// browser's View Transitions: navigate("Pricing", { type: "push-left", duration: 300 }). Going back (back(), the
// browser's back button or gesture) plays the same transition the other way.

type Direction = 'left' | 'right' | 'up' | 'down'
export type TransitionType = 'instant' | 'dissolve' | 'smart' | `push-${Direction}` | `move-in-${Direction}` | `move-out-${Direction}` | `slide-in-${Direction}` | `slide-out-${Direction}`

export interface NavigateOptions {
  type?: TransitionType
  duration?: number
  ease?: string
}

type StartViewTransition = (options: { update: () => void | Promise<void>; types: string[] }) => unknown

/** What each history entry records: its place in the history, and the transition that showed it. */
interface Step {
  kalaiStep: number
  transition?: NavigateOptions
}

let showScreen: ((screen: string) => void) | null = null
/** The history entry on screen now. */
let shown: Step = (window.history.state as Step | null) ?? { kalaiStep: 0 }
/** A back or forward transition is about to swap the screen itself. */
let swapping = false

/** App registers how it shows a screen, so a transition can capture the screen before and after. */
export function onShowScreen(setter: ((screen: string) => void) | null) {
  showScreen = setter
}

/** Runs `update` inside the transition, or straight away when there is none (or motion is reduced). */
function transition(options: NavigateOptions, update: () => void) {
  const type = options.type ?? 'instant'
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition
  if (type === 'instant' || !start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  const root = document.documentElement.style
  root.setProperty('--k-vt-duration', `${options.duration ?? 300}ms`)
  root.setProperty('--k-vt-ease', options.ease ?? 'ease-out')
  start.call(document, { update, types: [type] })
}

export function navigate(screen: string, options: NavigateOptions = {}) {
  transition(options, () => {
    shown = { kalaiStep: shown.kalaiStep + 1, transition: options }
    window.history.pushState(shown, '', `#/${screen}`)
    if (showScreen) flushSync(() => showScreen?.(screen))
    else window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

const kOpposite: Record<Direction, Direction> = { left: 'right', right: 'left', up: 'down', down: 'up' }

/** The way back: push-left becomes push-right, move-in-up becomes move-out-down, slide-in-left slide-out-right. */
export function reversed(type: TransitionType): TransitionType {
  const match = /^(push|move-in|move-out|slide-in|slide-out)-(left|right|up|down)$/.exec(type)
  if (!match) return type
  const kind = { push: 'push', 'move-in': 'move-out', 'move-out': 'move-in', 'slide-in': 'slide-out', 'slide-out': 'slide-in' }[match[1]]
  return `${kind}-${kOpposite[match[2] as Direction]}` as TransitionType
}

// Back and forward through the history (back(), the browser's buttons, a swipe): the screen changes inside the
// transition that showed it, reversed when going back. The app's own hashchange then finds it already shown.
window.addEventListener('popstate', (event) => {
  if (!showScreen) return
  const next = (event.state as Step | null) ?? { kalaiStep: 0 }
  const goingBack = next.kalaiStep < shown.kalaiStep
  // Back undoes how the screen being left came in; forward replays how the next one did.
  const options = (goingBack ? shown.transition : next.transition) ?? {}
  shown = next
  const screen = currentScreen()
  swapping = true
  transition(goingBack ? { ...options, type: reversed(options.type ?? 'instant') } : options, () => {
    swapping = false
    flushSync(() => showScreen?.(screen))
  })
})
// Registered before the app's own listener: while the transition holds the old screen, the app must not swap it.
window.addEventListener('hashchange', (event) => {
  if (swapping) event.stopImmediatePropagation()
})

export function currentScreen(): string {
  return window.location.hash.replace(/^#\/?/, '') || 'Home'
}

/** Back to the screen before, as the browser's back button does. */
export function back() {
  window.history.back()
}

// Overlays: another screen shown on top of this one (a dialog, a bottom sheet, a side panel). It draws itself,
// so it works in the app and in Kalai's preview alike; its backdrop or closeOverlay() closes it.
export type OverlayPosition = 'center' | 'top' | 'bottom' | 'left' | 'right'

export interface OverlayOptions {
  position?: OverlayPosition
  /** Clicking outside the overlay closes it (default true). */
  closeOnOutside?: boolean
  /** A dimmed backdrop behind it (default true). */
  backdrop?: boolean
  /** Its size as drawn [width, height]: shown at that size, as it looks (no added corners or shadow). */
  size?: [number, number]
  /** Placed by hand: [x, y] from the top-left of `anchor` (the element clicked). */
  at?: [number, number]
  anchor?: Element | null
}

const overlayScreens = import.meta.glob<{ default: ComponentType }>('../screens/*.tsx')
// Where a sized overlay sits, and how it comes in.
const kOverlayPlace: Record<OverlayPosition, string> = {
  center: 'm-auto animate-in fade-in zoom-in-95 duration-200',
  top: 'mx-auto mb-auto animate-in slide-in-from-top duration-300',
  bottom: 'mx-auto mt-auto animate-in slide-in-from-bottom duration-300',
  left: 'my-auto mr-auto animate-in slide-in-from-left duration-300',
  right: 'my-auto ml-auto animate-in slide-in-from-right duration-300',
}
const kOverlayPanel: Record<OverlayPosition, string> = {
  center: 'm-auto max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 [&>*]:min-h-0',
  top: 'mb-auto max-h-[85vh] w-full overflow-auto rounded-b-2xl shadow-2xl animate-in slide-in-from-top duration-300 [&>*]:min-h-0',
  bottom: 'mt-auto max-h-[85vh] w-full overflow-auto rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 [&>*]:min-h-0',
  left: 'mr-auto h-full w-[min(440px,90vw)] overflow-auto shadow-2xl animate-in slide-in-from-left duration-300',
  right: 'ml-auto h-full w-[min(440px,90vw)] overflow-auto shadow-2xl animate-in slide-in-from-right duration-300',
}
let overlay: { host: HTMLElement; root: Root } | null = null

export async function openOverlay(screen: string, options: OverlayOptions = {}) {
  const Screen = (await overlayScreens[`../screens/${screen}.tsx`]?.())?.default
  if (!Screen) return
  closeOverlay()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  overlay = { host, root }
  const position = options.position ?? 'center'
  const [width, height] = options.size ?? [0, 0]
  const box = options.anchor?.getBoundingClientRect()
  const placed = options.at && box ? { position: 'absolute' as const, left: box.left + options.at[0], top: box.top + options.at[1] } : {}
  // A sized overlay is its screen at its own size; its screen's h-screen gives way to that height.
  const className = options.size
    ? `pointer-events-auto max-h-full max-w-full overflow-auto [&>*]:h-full [&>*]:min-h-0 ${options.at && box ? 'animate-in fade-in duration-200' : kOverlayPlace[position]}`
    : `pointer-events-auto bg-background ${kOverlayPanel[position]}`
  const style = options.size ? { width, height, ...placed } : undefined
  const panel = createElement('div', { className, style, onClick: (event: MouseEvent) => event.stopPropagation() }, createElement(Screen))
  const backdrop = options.backdrop === false ? 'pointer-events-none' : 'bg-black/40 animate-in fade-in duration-200'
  root.render(createElement('div', { className: `fixed inset-0 z-50 flex ${backdrop}`, onClick: options.closeOnOutside === false ? undefined : closeOverlay }, panel))
}

export function closeOverlay() {
  overlay?.root.unmount()
  overlay?.host.remove()
  overlay = null
}

/** Scrolls smoothly to an element of the screen (found by its data-nid), `offset` px above it (a sticky header). */
export function scrollToElement(nid: string, options: { offset?: number } = {}) {
  const element = document.querySelector(`[data-nid="${nid}"]`)
  if (!element) return
  window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - (options.offset ?? 0), behavior: 'smooth' })
}

/** On a screen: runs `action` once, `ms` after the screen shows (a splash screen moving on, say). */
export function useAfterDelay(action: () => void, ms: number) {
  const latest = useRef(action)
  latest.current = action
  useEffect(() => {
    const timer = setTimeout(() => latest.current(), ms)
    return () => clearTimeout(timer)
  }, [ms])
}

/** On a screen: runs `action` when `key` is pressed ("Escape", "ArrowRight", "k"…). */
export function useKey(key: string, action: () => void) {
  const latest = useRef(action)
  latest.current = action
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === key && latest.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key])
}
