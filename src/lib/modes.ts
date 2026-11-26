// Variable modes in pop-ups. Dialogs, menus and tooltips are drawn at the end of <body>, outside the layer whose
// modes (data-theme="dark", data-<collection>="<mode>") they belong to; this gives them the modes of what opened them.

/** A selector part of a mode block: `:root`, `.dark` or `[data-brand="bigin"]`. */
const kModePart = /^(:root|\.dark|\[data-([a-z0-9-]+)="[^"\]]+"\])$/

let known: { names: string[]; at: number } | null = null

/** Attributes a mode block switches variables with: `:root, [data-brand="zoho"] { --x: …; }`. Read at most once a second. */
function modeAttributes(): string[] {
  if (known && performance.now() - known.at < 1000) return known.names
  const names = new Set(['theme'])
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (rule.style.length === 0 || !Array.from(rule.style).every((property) => property.startsWith('--'))) continue
        const parts = rule.selectorText.split(',').map((part) => kModePart.exec(part.trim()))
        if (parts.every(Boolean)) for (const part of parts) if (part?.[2]) names.add(part[2])
      } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules)
    } catch {
      // A stylesheet from another origin cannot be read.
    }
  }
  known = { names: [...names], at: performance.now() }
  return known.names
}

/** The modes where the user last clicked, pressed a key or pointed, taken then (a pop-up moves focus into itself). */
let modes: [string, string][] = []

function giveModes(node: Element): void {
  if (node.id === 'root' || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return
  for (const [name, value] of modes) if (!node.hasAttribute(`data-${name}`)) node.setAttribute(`data-${name}`, value)
}

/** Once per page: notes the modes where the user acts, and gives them to new pop-ups. */
export function followModesInPopups(): void {
  const page = window as typeof window & { __kalaiModes?: boolean }
  if (page.__kalaiModes) return
  page.__kalaiModes = true
  const remember = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return
    modes = modeAttributes().flatMap((name) => {
      const value = target.closest(`[data-${name}]`)?.getAttribute(`data-${name}`)
      return value ? [[name, value] as [string, string]] : []
    })
  }
  for (const type of ['pointerdown', 'pointerover', 'keydown']) document.addEventListener(type, remember, true)
  new MutationObserver((changes) => {
    for (const change of changes) for (const node of Array.from(change.addedNodes)) if (node instanceof Element) giveModes(node)
  }).observe(document.body, { childList: true })
}

followModesInPopups()
