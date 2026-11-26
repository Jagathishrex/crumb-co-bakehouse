import { createElement, useEffect, useState, type ComponentType } from 'react'
import { currentScreen, onShowScreen } from '@/lib/nav'

// Every file in src/screens is a screen; the URL hash picks which one shows.
const screenModules = import.meta.glob<{ default: ComponentType }>('./screens/*.tsx', { eager: true })

function screenFor(name: string): ComponentType | undefined {
  return screenModules[`./screens/${name}.tsx`]?.default
}

export default function App() {
  const [screen, setScreen] = useState(currentScreen())

  // navigate() shows screens through this, so a transition can capture before and after.
  useEffect(() => {
    onShowScreen(setScreen)
    return () => onShowScreen(null)
  }, [])

  useEffect(() => {
    const onHashChange = () => setScreen(currentScreen())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // An unknown or missing start screen falls back to the first one; a new project has none yet.
  // The screen is looked up, not made here, so createElement says so to React's lint.
  const Screen = screenFor(screen) ?? Object.values(screenModules)[0]?.default
  return Screen ? createElement(Screen) : null
}
