// Kalai's video charts: numbers that count up and charts that grow on the frame clock (./video), so a video exports
// exactly what it previews. On the canvas (no player) each one shows its end: the whole number, the full chart.
//
//   <Counter to={18.2} decimals={1} suffix="M" at={0.3} />                // 9.1M → 18.2M, from 0.3 s, over 1.2 s
//   <GrowBars data={[{ label: 'Q1', value: 4 }, …]} stagger={0.3} />      // bars rise one after another
//   <DrawLine values={[3, 5, 4, 8, 12]} />                               // a line drawn left to right
//   <FillRing value={0.72} />                                            // a ring that fills, "72%" in the middle
//
// A Recharts chart (ChartContainer) animates on its own timer, which the export cannot step: give every series
// isAnimationActive={false} and the clock's data instead, data={useGrowData(rows, { keys: ['revenue'] })}.
//
// `at` (seconds from the start of the scene) and `seconds` time each one. Written with createElement, not JSX, like
// the kit, so the canvas never mistakes these boxes for a screen's layers.
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig, type EasingFunction } from './video';

/** ease-smooth (motion.css): quick out of the start, a long soft landing. */
const kSmooth = Easing.bezier(0.16, 1, 0.3, 1);

export interface Timing {
  /** When it starts, in seconds from the start of the scene (or Sequence). */
  at?: number;
  /** How long it takes. */
  seconds?: number;
  easing?: EasingFunction;
}

/** 0 → 1 across [at, at + seconds] at `frame`, eased; 0 before, 1 after. */
export function progressAt(frame: number, fps: number, { at = 0, seconds = 1, easing = kSmooth }: Timing = {}): number {
  const start = at * fps;
  const end = start + Math.max(1, seconds * fps);
  return interpolate(frame, [start, end], [0, 1], { easing });
}

/** The same, on the clock: what the scene's current frame makes of it. */
export function useProgress(timing: Timing = {}): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return progressAt(frame, fps, timing);
}

/** How many decimals a number is written with: 18.25 → 2. */
function decimalsOf(value: number): number {
  const text = String(value);
  return text.includes('.') && !text.includes('e') ? text.split('.')[1].length : 0;
}

/** A number as it is shown: grouped digits, a fixed number of decimals. */
export function formatCount(value: number, decimals = 0, locale?: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/**
 * A number counting up to `to` on the clock. It starts from about half (`from`: to / 2) rather than 0, so a paused
 * frame never says "0 signups".
 */
export function useCountUp(to: number, { from = to / 2, at = 0, seconds = 1.2, easing }: Timing & { from?: number } = {}): number {
  return from + (to - from) * useProgress({ at, seconds, easing });
}

export interface CounterProps extends Timing {
  to: number;
  /** Where it starts: half of `to` unless set. */
  from?: number;
  /** Decimals shown; as many as `to` has unless set. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  className?: string;
  style?: CSSProperties;
}

/** A number that counts up: <Counter to={18.2} suffix="M" />. Its digits keep one width, so it does not jitter. */
export function Counter({ to, from, decimals, prefix = '', suffix = '', locale, className, style, at, seconds, easing }: CounterProps) {
  const value = useCountUp(to, { from, at, seconds, easing });
  const shown = formatCount(value, decimals ?? decimalsOf(to), locale);
  return createElement('span', { className, style: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...style } }, `${prefix}${shown}${suffix}`);
}

/** Rows with their `keys` grown from 0 (or `from`): row i at progress(i), so bars can rise one after another. */
export function growRows<Row extends Record<string, unknown>>(rows: readonly Row[], keys: readonly (keyof Row)[], progress: (index: number) => number, from = 0): Row[] {
  return rows.map((row, index) => {
    const amount = progress(index);
    const grown: Record<string, unknown> = { ...row };
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'number') grown[key as string] = from + (value - from) * amount;
    }
    return grown as Row;
  });
}

/**
 * A Recharts chart's data grown on the clock: <BarChart data={useGrowData(rows, { keys: ['revenue'] })}> with
 * isAnimationActive={false} on each series. `stagger` (seconds) starts each row that much after the one before.
 */
export function useGrowData<Row extends Record<string, unknown>>(rows: readonly Row[], { keys, from = 0, stagger = 0, at = 0, seconds = 1, easing }: Timing & { keys: readonly (keyof Row)[]; from?: number; stagger?: number }): Row[] {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return growRows(rows, keys, (index) => progressAt(frame, fps, { at: at + index * stagger, seconds, easing }), from);
}

export interface Bar {
  label: string;
  value: number;
  /** This bar's own colour classes (bg-…), in place of barClassName. */
  className?: string;
}

export interface GrowBarsProps extends Timing {
  data: readonly Bar[];
  /** The value of a full-height bar: the largest value unless set. */
  max?: number;
  /** Seconds between one bar starting and the next. */
  stagger?: number;
  /** 'up': columns side by side; 'right': rows that grow to the right. */
  direction?: 'up' | 'right';
  /** The value over each bar, counting with it. */
  showValues?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  barClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  style?: CSSProperties;
}

/** A bar chart whose bars rise one after another on the clock. It fills its box: give it a size. */
export function GrowBars({ data, max, stagger = 0.3, direction = 'up', showValues = true, decimals, prefix = '', suffix = '', className, barClassName = 'bg-primary', labelClassName = 'text-3xl text-muted-foreground', valueClassName = 'text-4xl font-semibold', style, at = 0, seconds = 0.8, easing }: GrowBarsProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const top = max ?? Math.max(1e-9, ...data.map((bar) => bar.value));
  const places = decimals ?? Math.max(0, ...data.map((bar) => decimalsOf(bar.value)));
  const up = direction === 'up';
  const bars = data.map((bar, index) => {
    const amount = progressAt(frame, fps, { at: at + index * stagger, seconds, easing });
    const size = `${Math.max(0, Math.min(1, bar.value / top)) * amount * 100}%`;
    const value = showValues ? createElement('span', { className: valueClassName, style: { opacity: Math.min(1, amount * 3), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }, `${prefix}${formatCount(bar.value * amount, places)}${suffix}`) : null;
    const fill = createElement('div', { className: bar.className ?? barClassName, style: up ? { width: '100%', height: size, borderRadius: 12 } : { height: '100%', width: size, borderRadius: 12 } });
    const label = createElement('span', { className: labelClassName, style: { whiteSpace: 'nowrap' } }, bar.label);
    return up
      ? createElement('div', { key: index, style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, height: '100%' } }, createElement('div', { style: { flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 12 } }, value, fill), label)
      : createElement('div', { key: index, style: { flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 24 } }, createElement('div', { style: { width: '20%', textAlign: 'right' } }, label), createElement('div', { style: { flex: 1, height: '70%', display: 'flex', alignItems: 'center', gap: 16 } }, fill, value));
  });
  return createElement('div', { className, style: { display: 'flex', flexDirection: up ? 'row' : 'column', alignItems: 'stretch', gap: up ? 32 : 20, width: '100%', height: '100%', ...style } }, bars);
}

/** The points of a line chart in a width × height box, lowest value at the bottom, inset by `pad`. */
export function linePoints(values: readonly number[], width: number, height: number, pad = 0, range?: { min?: number; max?: number }): [number, number][] {
  const low = range?.min ?? Math.min(...values);
  const high = range?.max ?? Math.max(...values);
  const span = high - low || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((value, index) => [pad + index * step, height - pad - ((value - low) / span) * (height - pad * 2)]);
}

/** The point `amount` (0–1) of the way along a polyline, by length. */
export function pointAlong(points: readonly [number, number][], amount: number): [number, number] {
  if (points.length === 0) return [0, 0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  let left = Math.max(0, Math.min(1, amount)) * lengths.reduce((sum, length) => sum + length, 0);
  for (const [index, length] of lengths.entries()) {
    if (left <= length && length > 0) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[index + 1];
      return [x0 + ((x1 - x0) * left) / length, y0 + ((y1 - y0) * left) / length];
    }
    left -= length;
  }
  return points[points.length - 1];
}

export interface DrawLineProps extends Timing {
  values: readonly number[];
  /** The drawing's size (its viewBox); it scales to its box's width. */
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  strokeWidth?: number;
  /** stroke-… classes for the line. */
  className?: string;
  /** fill-… classes for the dot at the line's tip; dot={false} for none. */
  dotClassName?: string;
  dot?: boolean;
  style?: CSSProperties;
}

/** A line chart that draws itself left to right, with a dot riding its tip. */
export function DrawLine({ values, width = 1200, height = 400, min, max, strokeWidth = 8, className = 'stroke-primary', dotClassName = 'fill-primary', dot = true, style, at = 0, seconds = 1.5, easing }: DrawLineProps) {
  const amount = useProgress({ at, seconds, easing });
  const radius = strokeWidth * 1.8;
  const points = linePoints(values, width, height, radius, { min, max });
  const d = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [tipX, tipY] = pointAlong(points, amount);
  return createElement(
    'svg',
    { viewBox: `0 0 ${width} ${height}`, style: { width: '100%', height: 'auto', overflow: 'visible', ...style }, 'aria-hidden': true },
    createElement('path', { d, pathLength: 1, className, fill: 'none', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: 1, strokeDashoffset: 1 - amount, style: { opacity: amount > 0 ? 1 : 0 } }),
    dot && amount > 0 ? createElement('circle', { cx: tipX, cy: tipY, r: radius, className: dotClassName }) : null,
  );
}

export interface FillRingProps extends Timing {
  /** How full, 0–1. */
  value: number;
  size?: number;
  thickness?: number;
  /** stroke-… classes for the filled part and the track. */
  className?: string;
  trackClassName?: string;
  /** What sits in the middle: a counting percentage unless set (null for nothing). */
  children?: ReactNode;
  labelClassName?: string;
  style?: CSSProperties;
}

/** A ring that fills to `value`, with the percentage counting up in the middle. */
export function FillRing({ value, size = 360, thickness = 32, className = 'stroke-primary', trackClassName = 'stroke-muted', children, labelClassName = 'text-7xl font-semibold', style, at = 0, seconds = 1.2, easing }: FillRingProps) {
  const amount = useProgress({ at, seconds, easing });
  const middle = size / 2;
  const radius = middle - thickness / 2;
  const share = Math.max(0, Math.min(1, value));
  const circle = (classes: string, extra: Record<string, unknown>) => createElement('circle', { cx: middle, cy: middle, r: radius, fill: 'none', strokeWidth: thickness, className: classes, ...extra });
  const label = children === undefined ? createElement(Counter, { to: Math.round(share * 1000) / 10, suffix: '%', at, seconds, easing, className: labelClassName }) : children;
  return createElement(
    'div',
    { style: { position: 'relative', width: size, height: size, ...style } },
    createElement('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: { transform: 'rotate(-90deg)' }, 'aria-hidden': true }, circle(trackClassName, {}), circle(className, { pathLength: 1, strokeLinecap: 'round', strokeDasharray: 1, strokeDashoffset: 1 - share * amount, style: { opacity: amount > 0 ? 1 : 0 } })),
    label === null ? null : createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, label),
  );
}
