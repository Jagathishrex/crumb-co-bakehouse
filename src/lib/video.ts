// Kalai's video kit: motion driven by a frame clock, so a video exports exactly, frame by frame.
//
//   const frame = useCurrentFrame();                  // 0, 1, 2 … from the start of this scene
//   const { fps } = useVideoConfig();
//   const opacity = interpolate(frame, [0, 30], [0, 1]);
//   const scale = spring({ frame, fps });             // 0 → 1 with a natural bounce
//
// The ideas follow Remotion (remotion.dev); this is Kalai's own code. One difference: interpolate() clamps to its
// output range unless told to extend. CSS animations (animate-in, loop-*, motion.css) need none of this: Kalai's
// export steps them too. Use the clock for what CSS can't do: counting numbers, charts, canvas, 3D, springs.
//
// Written with createElement, not JSX, so the canvas never mistakes the kit's own boxes for a screen's layers.
import { Children, createContext, createElement, isValidElement, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ImgHTMLAttributes, type ReactElement, type ReactNode } from 'react';

// --- the clock -------------------------------------------------------------------------------------

interface Clock {
  frame: number;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  playing: boolean;
  /** Work a frame waits for (delayRender), by handle. */
  pending: Map<number, string>;
  listeners: Set<() => void>;
  /** Shows a frame now. */
  set(frame: number): void;
  /** Shows a frame and resolves once it is drawn and nothing it loads is pending (the exporter waits on this). */
  seek(frame: number): Promise<void>;
  play(): void;
  pause(): void;
}

/** On the canvas (no player), a screen rests at its end, the way CSS motion rests there. */
const kRestFrame = 1_000_000;

function makeClock(): Clock {
  const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  const asked = Number(params.get('frame'));
  let raf = 0;
  const clock: Clock = {
    frame: Number.isFinite(asked) && params.has('frame') ? asked : kRestFrame,
    fps: Number(params.get('fps')) || 30,
    width: typeof window === 'undefined' ? 1920 : window.innerWidth,
    height: typeof window === 'undefined' ? 1080 : window.innerHeight,
    durationInFrames: Number(params.get('frames')) || 120,
    playing: false,
    pending: new Map(),
    listeners: new Set(),
    set(frame) {
      if (frame === clock.frame) return;
      clock.frame = frame;
      clock.listeners.forEach((listener) => listener());
    },
    async seek(frame) {
      clock.set(frame);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const started = Date.now();
      while (clock.pending.size > 0 && Date.now() - started < 30_000) await new Promise((resolve) => setTimeout(resolve, 10));
    },
    play() {
      if (clock.playing) return;
      clock.playing = true;
      if (clock.frame >= clock.durationInFrames - 1) clock.set(0);
      const startFrame = clock.frame;
      const startTime = performance.now();
      const tick = (now: number) => {
        if (!clock.playing) return;
        const frame = startFrame + Math.floor(((now - startTime) / 1000) * clock.fps);
        if (frame >= clock.durationInFrames) {
          clock.set(clock.durationInFrames - 1);
          clock.pause();
          return;
        }
        clock.set(frame);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      clock.listeners.forEach((listener) => listener());
    },
    pause() {
      clock.playing = false;
      cancelAnimationFrame(raf);
      clock.listeners.forEach((listener) => listener());
    },
  };
  return clock;
}

const holder = (typeof window === 'undefined' ? {} : window) as { __kalaiClock?: Clock };
/** One clock per page: the player and the exporter set it, every scene reads it. */
export const clock: Clock = (holder.__kalaiClock ??= makeClock());

function subscribe(listener: () => void) {
  clock.listeners.add(listener);
  return () => clock.listeners.delete(listener);
}

function useGlobalFrame(): number {
  return useSyncExternalStore(subscribe, () => clock.frame, () => clock.frame);
}

// A Sequence, Loop or Freeze changes what "now" means for what is inside it.
const FrameMap = createContext<(global: number) => number>((global) => global);

export interface VideoConfig {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}
const ConfigContext = createContext<VideoConfig | null>(null);

/** The frame now, counted from the start of the scene (or Sequence) this is in. */
export function useCurrentFrame(): number {
  const map = useContext(FrameMap);
  return map(useGlobalFrame());
}

/** The video's frame rate and size, and how long the scene (or Sequence) this is in lasts. */
export function useVideoConfig(): VideoConfig {
  return useContext(ConfigContext) ?? { fps: clock.fps, width: clock.width, height: clock.height, durationInFrames: clock.durationInFrames };
}

/** Gives what is inside a size, frame rate and length (the player wraps the whole video in one). */
export function VideoConfigProvider({ config, children }: { config: Partial<VideoConfig>; children?: ReactNode }) {
  const parent = useVideoConfig();
  const value = useMemo(() => ({ ...parent, ...config }), [parent, config]);
  return createElement(ConfigContext.Provider, { value }, children);
}

// --- waiting for things to load ------------------------------------------------------------------

let nextHandle = 1;

/** Holds the frame until continueRender(handle): a picture, a font or data the frame needs. */
export function delayRender(label = 'delayRender'): number {
  const handle = nextHandle++;
  clock.pending.set(handle, label);
  return handle;
}

export function continueRender(handle: number): void {
  clock.pending.delete(handle);
}

/** A file in the project's public folder, by its path there ("music/intro.mp3"). */
export function staticFile(file: string): string {
  return `/${file.replace(/^\/+/, '')}`;
}

/** An <img> the frame waits for, so it never exports half-loaded. */
export function Img(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [handle] = useState(() => delayRender(`Img ${props.src ?? ''}`));
  useLayoutEffect(() => () => continueRender(handle), [handle]);
  return createElement('img', {
    ...props,
    onLoad: (event: never) => {
      continueRender(handle);
      props.onLoad?.(event);
    },
    onError: (event: never) => {
      continueRender(handle);
      props.onError?.(event);
    },
  });
}

// --- easing and interpolation --------------------------------------------------------------------

export type EasingFunction = (t: number) => number;

/** A CSS cubic-bezier(x1, y1, x2, y2). */
function bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  return (x) => {
    if (x <= 0 || x >= 1) return x;
    let t = x;
    for (let step = 0; step < 8; step++) {
      const error = at(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return at(y1, y2, t);
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let step = 0; step < 30; step++) {
      const value = at(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return at(y1, y2, t);
  };
}

export const Easing = {
  linear: (t: number) => t,
  ease: bezier(0.42, 0, 1, 1),
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  poly: (n: number) => (t: number) => t ** n,
  sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  circle: (t: number) => 1 - Math.sqrt(1 - t * t),
  exp: (t: number) => (t === 0 ? 0 : 2 ** (10 * (t - 1))),
  back: (s = 1.70158) => (t: number) => t * t * ((s + 1) * t - s),
  elastic: (bounciness = 1) => {
    const p = bounciness * Math.PI;
    return (t: number) => 1 - Math.cos((t * Math.PI) / 2) ** 3 * Math.cos(t * p);
  },
  bounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  bezier,
  in: (easing: EasingFunction) => easing,
  out: (easing: EasingFunction) => (t: number) => 1 - easing(1 - t),
  inOut: (easing: EasingFunction) => (t: number) => (t < 0.5 ? easing(t * 2) / 2 : 1 - easing((1 - t) * 2) / 2),
};

export type Extrapolate = 'clamp' | 'extend' | 'identity' | 'wrap';

export interface InterpolateOptions {
  easing?: EasingFunction;
  /** Before the first input: 'clamp' (the default here) holds the first output; 'extend' keeps the line going. */
  extrapolateLeft?: Extrapolate;
  extrapolateRight?: Extrapolate;
}

/** Maps a number from one range to another: interpolate(frame, [0, 30], [0, 1]) fades in over 30 frames. */
export function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[], options: InterpolateOptions = {}): number {
  if (inputRange.length !== outputRange.length || inputRange.length < 2) throw new Error('interpolate() needs two ranges of the same length, at least 2 long');
  for (let index = 1; index < inputRange.length; index++) {
    if (!(inputRange[index] > inputRange[index - 1])) throw new Error('interpolate() needs inputRange to go strictly up');
  }
  const easing = options.easing ?? Easing.linear;
  const first = inputRange[0];
  const last = inputRange[inputRange.length - 1];
  let value = input;
  const edge = (mode: Extrapolate, end: number): number | null => {
    if (mode === 'identity') return input;
    if (mode === 'clamp') {
      value = end;
      return null;
    }
    if (mode === 'wrap') {
      const span = last - first;
      value = first + ((((input - first) % span) + span) % span);
    }
    return null;
  };
  if (input < first) {
    const out = edge(options.extrapolateLeft ?? 'clamp', first);
    if (out !== null) return out;
  } else if (input > last) {
    const out = edge(options.extrapolateRight ?? 'clamp', last);
    if (out !== null) return out;
  }
  let segment = 1;
  while (segment < inputRange.length - 1 && value > inputRange[segment]) segment++;
  const from = inputRange[segment - 1];
  const to = inputRange[segment];
  const progress = (value - from) / (to - from);
  // Inside a segment the easing applies; past the ends ('extend') the line keeps its slope.
  const eased = progress >= 0 && progress <= 1 ? easing(progress) : progress;
  return outputRange[segment - 1] + (outputRange[segment] - outputRange[segment - 1]) * eased;
}

const colorCache = new Map<string, [number, number, number, number]>();
let colorCanvas: CanvasRenderingContext2D | null = null;

/** Any CSS colour as [r, g, b, a] (0–255, alpha 0–1), drawn once on a 1px canvas so oklch() and names work too. */
function rgba(color: string): [number, number, number, number] {
  const known = colorCache.get(color);
  if (known) return known;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
  let result: [number, number, number, number] = [0, 0, 0, 1];
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit) : hex[1].match(/../g)!;
    result = [parseInt(digits[0], 16), parseInt(digits[1], 16), parseInt(digits[2], 16), digits[3] ? parseInt(digits[3], 16) / 255 : 1];
  } else if (typeof document !== 'undefined') {
    colorCanvas ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    if (colorCanvas) {
      colorCanvas.clearRect(0, 0, 1, 1);
      colorCanvas.fillStyle = color;
      colorCanvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = colorCanvas.getImageData(0, 0, 1, 1).data;
      result = a === 0 ? [0, 0, 0, 0] : [Math.round((r * 255) / a), Math.round((g * 255) / a), Math.round((b * 255) / a), a / 255];
    }
  }
  colorCache.set(color, result);
  return result;
}

/** Mixes colours over a range: interpolateColors(frame, [0, 60], ['#8b5cf6', '#14b8a6']). */
export function interpolateColors(input: number, inputRange: readonly number[], colors: readonly string[]): string {
  const parsed = colors.map(rgba);
  const channel = (index: number) => interpolate(input, inputRange, parsed.map((color) => color[index]));
  const [r, g, b, a] = [0, 1, 2, 3].map(channel);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`;
}

// --- springs -------------------------------------------------------------------------------------

export interface SpringConfig {
  damping: number;
  mass: number;
  stiffness: number;
  /** Never past the target (no bounce beyond it). */
  overshootClamping: boolean;
}

export const kSpringDefaults: SpringConfig = { damping: 10, mass: 1, stiffness: 100, overshootClamping: false };

/** Where a spring released from 0 (target 1) is after `t` seconds, and how fast it moves. */
function springAt(t: number, config: SpringConfig, velocity = 0): { value: number; speed: number } {
  const { damping, mass, stiffness } = config;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = -1;
  const v0 = velocity;
  let x: number;
  let v: number;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const a = x0;
    const b = (v0 + zeta * w0 * x0) / wd;
    const decay = Math.exp(-zeta * w0 * t);
    x = decay * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
    v = decay * ((b * wd - zeta * w0 * a) * Math.cos(wd * t) - (a * wd + zeta * w0 * b) * Math.sin(wd * t));
  } else if (zeta === 1) {
    const b = v0 + w0 * x0;
    const decay = Math.exp(-w0 * t);
    x = decay * (x0 + b * t);
    v = decay * (b - w0 * (x0 + b * t));
  } else {
    // Two decaying exponentials (cosh and sinh would overflow for a stiff spring).
    const wd = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + wd;
    const r2 = -zeta * w0 - wd;
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    v = r1 * c1 * Math.exp(r1 * t) + r2 * c2 * Math.exp(r2 * t);
  }
  return { value: 1 + x, speed: v };
}

/** How many frames a spring takes to settle (within 0.5% of its target and nearly still). */
export function measureSpring({ fps, config = {}, threshold = 0.005 }: { fps: number; config?: Partial<SpringConfig>; threshold?: number }): number {
  const full = { ...kSpringDefaults, ...config };
  for (let frame = 0; frame < fps * 60; frame++) {
    let settled = true;
    // Settled from here on: check a stretch ahead, as an underdamped spring passes through 1 on its way.
    for (let ahead = 0; ahead < fps && settled; ahead += 2) {
      const { value, speed } = springAt((frame + ahead) / fps, full);
      settled = Math.abs(1 - value) < threshold && Math.abs(speed) < threshold * 10;
    }
    if (settled) return frame;
  }
  return fps * 60;
}

export interface SpringOptions {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  /** Stretch or squeeze it to settle in exactly this many frames. */
  durationInFrames?: number;
  /** Frames to wait before it starts. */
  delay?: number;
  reverse?: boolean;
}

/** A spring from `from` (0) to `to` (1): spring({ frame, fps, config: { damping: 200 } }) for no bounce. */
export function spring({ frame, fps, config = {}, from = 0, to = 1, durationInFrames, delay = 0, reverse = false }: SpringOptions): number {
  const full = { ...kSpringDefaults, ...config };
  let local = frame - delay;
  if (durationInFrames !== undefined) local = (local * Math.max(1, measureSpring({ fps, config: full }))) / durationInFrames;
  let progress = local <= 0 ? 0 : springAt(local / fps, full).value;
  if (full.overshootClamping) progress = Math.min(1, progress);
  // Reversed, it springs back from `to` to `from`.
  if (reverse) progress = 1 - progress;
  return from + (to - from) * progress;
}

// --- arranging time ------------------------------------------------------------------------------

const kFill: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' };

/** A box that fills the frame: scenes and layers stack in these. */
export function AbsoluteFill({ style, ...props }: { style?: CSSProperties; className?: string; children?: ReactNode }) {
  return createElement('div', { ...props, style: { ...kFill, ...style } });
}

export interface SequenceProps {
  /** The frame it starts at (inside it, useCurrentFrame() is 0 there). */
  from?: number;
  /** How long it shows; forever when left out. */
  durationInFrames?: number;
  /** 'none' leaves layout to its children instead of filling the frame. */
  layout?: 'absolute-fill' | 'none';
  name?: string;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

/** Shows its children from `from` for `durationInFrames`, with time counted from its start. */
export function Sequence({ from = 0, durationInFrames = Infinity, layout = 'absolute-fill', name, style, className, children }: SequenceProps) {
  const parent = useContext(FrameMap);
  const config = useVideoConfig();
  const local = parent(useGlobalFrame()) - from;
  const map = useMemo(() => (global: number) => parent(global) - from, [parent, from]);
  const inner = useMemo(() => ({ ...config, durationInFrames: Number.isFinite(durationInFrames) ? durationInFrames : config.durationInFrames }), [config, durationInFrames]);
  if (local < 0 || local >= durationInFrames) return null;
  const content = createElement(ConfigContext.Provider, { value: inner }, createElement(FrameMap.Provider, { value: map }, children));
  return layout === 'none' ? content : createElement('div', { 'data-sequence': name ?? '', className, style: { ...kFill, ...style } }, content);
}

/** Plays its children again every `durationInFrames`, `times` times (forever when left out). */
export function Loop({ durationInFrames, times = Infinity, layout = 'absolute-fill', children }: { durationInFrames: number; times?: number; layout?: 'absolute-fill' | 'none'; children?: ReactNode }) {
  const parent = useContext(FrameMap);
  const map = useMemo(
    () => (global: number) => {
      const frame = parent(global);
      if (frame < 0) return frame;
      return frame >= durationInFrames * times ? frame - durationInFrames * (times - 1) : frame % durationInFrames;
    },
    [parent, durationInFrames, times],
  );
  const content = createElement(FrameMap.Provider, { value: map }, children);
  return layout === 'none' ? content : createElement('div', { style: kFill }, content);
}

/** Holds its children at one frame. */
export function Freeze({ frame, active = true, children }: { frame: number; active?: boolean; children?: ReactNode }) {
  const parent = useContext(FrameMap);
  const map = useMemo(() => (active ? () => frame : parent), [active, frame, parent]);
  return createElement(FrameMap.Provider, { value: map }, children);
}

/**
 * A slow push-in for a held scene: scale 1 → `to` across `seconds` (the whole scene by default), eased. It is drawn on
 * the GPU, so text glides; a plain transform puts text on whole pixels and it steps a pixel at a time.
 */
export function PushIn({ to = 1.03, seconds, origin = '50% 50%', className, style, children }: { to?: number; seconds?: number; origin?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const length = Math.max(1, seconds ? seconds * fps : durationInFrames);
  const scale = interpolate(frame, [0, length], [1, to], { easing: Easing.inOut(Easing.sin) });
  return createElement('div', { className, style: { ...style, transform: `scale(${scale})`, transformOrigin: origin, willChange: 'transform' } }, children);
}

function SeriesSequence(_props: { durationInFrames: number; offset?: number; layout?: 'absolute-fill' | 'none'; name?: string; children?: ReactNode }): ReactElement | null {
  return null;
}

/** Children one after another: <Series><Series.Sequence durationInFrames={60}>…</Series.Sequence>…</Series>. */
export function Series({ children }: { children?: ReactNode }) {
  let cursor = 0;
  const items: ReactElement[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ durationInFrames: number; offset?: number; layout?: 'absolute-fill' | 'none'; name?: string; children?: ReactNode }>(child)) return;
    const { durationInFrames, offset = 0, layout, name } = child.props;
    const from = cursor + offset;
    items.push(createElement(Sequence, { key: items.length, from, durationInFrames, layout, name }, child.props.children));
    cursor = from + durationInFrames;
  });
  return createElement('div', { style: kFill }, items);
}
Series.Sequence = SeriesSequence;

// --- transitions ---------------------------------------------------------------------------------

export type TransitionDirection = 'entering' | 'exiting';

/** How a transition draws: the style of the scene coming in or going out, at progress 0 → 1. */
export interface TransitionPresentation {
  style(progress: number, direction: TransitionDirection): CSSProperties;
}

export interface TransitionTiming {
  durationInFrames: number;
  progress(frame: number, fps: number): number;
}

export function linearTiming({ durationInFrames, easing = Easing.linear }: { durationInFrames: number; easing?: EasingFunction }): TransitionTiming {
  return { durationInFrames, progress: (frame) => easing(Math.min(1, Math.max(0, frame / durationInFrames))) };
}

export function springTiming({ config, durationInFrames }: { config?: Partial<SpringConfig>; durationInFrames: number }): TransitionTiming {
  return { durationInFrames, progress: (frame, fps) => Math.min(1, spring({ frame, fps, config, durationInFrames })) };
}

type Side = 'from-left' | 'from-right' | 'from-top' | 'from-bottom';

const offsets: Record<Side, [number, number]> = { 'from-left': [-1, 0], 'from-right': [1, 0], 'from-top': [0, -1], 'from-bottom': [0, 1] };

export function none(): TransitionPresentation {
  return { style: () => ({}) };
}

/** The new scene fades in over the old one. */
export function fade(): TransitionPresentation {
  return { style: (progress, direction) => (direction === 'entering' ? { opacity: progress } : {}) };
}

/** The new scene pushes the old one out. */
export function slide({ direction = 'from-right' }: { direction?: Side } = {}): TransitionPresentation {
  const [x, y] = offsets[direction];
  return {
    style: (progress, way) => {
      const amount = way === 'entering' ? 1 - progress : -progress;
      return { transform: `translate(${x * amount * 100}%, ${y * amount * 100}%)` };
    },
  };
}

/** The new scene is revealed by a moving edge. */
export function wipe({ direction = 'from-right' }: { direction?: Side } = {}): TransitionPresentation {
  return {
    style: (progress, way) => {
      if (way === 'exiting') return {};
      const rest = (1 - progress) * 100;
      const inset = { 'from-left': `0 ${rest}% 0 0`, 'from-right': `0 0 0 ${rest}%`, 'from-top': `0 0 ${rest}% 0`, 'from-bottom': `${rest}% 0 0 0` }[direction];
      return { clipPath: `inset(${inset})` };
    },
  };
}

/** The old scene turns away and the new one turns in, like a card. */
export function flip(): TransitionPresentation {
  return {
    style: (progress, way) =>
      way === 'exiting'
        ? { transform: `perspective(2000px) rotateY(${progress * 180}deg)`, backfaceVisibility: 'hidden' }
        : { transform: `perspective(2000px) rotateY(${(progress - 1) * 180}deg)`, backfaceVisibility: 'hidden' },
  };
}

/** The new scene opens from a growing circle in the middle. */
export function iris(): TransitionPresentation {
  return { style: (progress, way) => (way === 'entering' ? { clipPath: `circle(${progress * 75}% at 50% 50%)` } : {}) };
}

/** The new scene is swept in like a clock hand. */
export function clockWipe(): TransitionPresentation {
  return {
    style: (progress, way) => {
      if (way === 'exiting') return {};
      const mask = `conic-gradient(#000 ${progress * 360}deg, transparent ${progress * 360}deg)`;
      return { maskImage: mask, WebkitMaskImage: mask };
    },
  };
}

/** The old scene grows and fades while the new one settles in. */
export function zoom(): TransitionPresentation {
  return {
    style: (progress, way) => (way === 'entering' ? { transform: `scale(${0.85 + 0.15 * progress})`, opacity: progress } : { transform: `scale(${1 + 0.15 * progress})`, opacity: 1 - progress }),
  };
}

interface TransitionSequenceProps {
  durationInFrames: number;
  name?: string;
  children?: ReactNode;
}

function TransitionSequence(_props: TransitionSequenceProps): ReactElement | null {
  return null;
}

function TransitionMark(_props: { presentation?: TransitionPresentation; timing: TransitionTiming }): ReactElement | null {
  return null;
}

interface Planned {
  from: number;
  durationInFrames: number;
  name?: string;
  children?: ReactNode;
  enter?: { presentation: TransitionPresentation; timing: TransitionTiming };
  exit?: { presentation: TransitionPresentation; timing: TransitionTiming };
}

function TransitionFrame({ plan, children }: { plan: Planned; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let style: CSSProperties = {};
  if (plan.enter && frame < plan.enter.timing.durationInFrames) style = { ...style, ...plan.enter.presentation.style(plan.enter.timing.progress(frame, fps), 'entering') };
  const exitStart = plan.durationInFrames - (plan.exit?.timing.durationInFrames ?? 0);
  if (plan.exit && frame >= exitStart) {
    const exiting = plan.exit.presentation.style(plan.exit.timing.progress(frame - exitStart, fps), 'exiting');
    style = { ...style, ...exiting, ...(style.transform && exiting.transform ? { transform: `${style.transform} ${exiting.transform}` } : {}) };
  }
  return createElement('div', { style: { ...kFill, ...style } }, children);
}

/**
 * Scenes one after another with transitions between them; a transition overlaps the two scenes:
 *   <TransitionSeries>
 *     <TransitionSeries.Sequence durationInFrames={90}>…</TransitionSeries.Sequence>
 *     <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
 *     <TransitionSeries.Sequence durationInFrames={90}>…</TransitionSeries.Sequence>
 *   </TransitionSeries>
 */
export function TransitionSeries({ children }: { children?: ReactNode }) {
  const plans: Planned[] = [];
  let cursor = 0;
  let pending: Planned['enter'] | undefined;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === TransitionMark) {
      const props = child.props as { presentation?: TransitionPresentation; timing: TransitionTiming };
      pending = { presentation: props.presentation ?? fade(), timing: props.timing };
      if (plans.length) plans[plans.length - 1].exit = pending;
      return;
    }
    const props = child.props as TransitionSequenceProps;
    const overlap = pending && plans.length ? pending.timing.durationInFrames : 0;
    const plan: Planned = { from: cursor - overlap, durationInFrames: props.durationInFrames, name: props.name, children: props.children, ...(overlap && pending ? { enter: pending } : {}) };
    plans.push(plan);
    cursor = plan.from + plan.durationInFrames;
    pending = undefined;
  });
  return createElement(
    'div',
    { style: kFill },
    plans.map((plan, index) => createElement(Sequence, { key: index, from: plan.from, durationInFrames: plan.durationInFrames, name: plan.name }, createElement(TransitionFrame, { plan }, plan.children))),
  );
}
TransitionSeries.Sequence = TransitionSequence;
TransitionSeries.Transition = TransitionMark;

/** Frames a TransitionSeries lasts: its scenes minus the overlaps. */
export function seriesDuration(scenes: { durationInFrames: number }[], transitions: number[]): number {
  return scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) - transitions.reduce((sum, frames) => sum + frames, 0);
}
