import React, { createContext, useContext, useEffect, useCallback, ReactNode, useRef } from 'react'

type HotkeyHandler = () => void

interface HotkeyContextType {
  register: (key: string, handler: HotkeyHandler) => () => void
}

const HotkeyContext = createContext<HotkeyContextType | null>(null)

// Stack of handlers for each hotkey so child unmounts restore parent handlers (like AppShell F2)
const handlerStacks = new Map<string, HotkeyHandler[]>()

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  return parts.join('+')
}

export function HotkeyProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow function keys (F2, F10, etc.) even when typing inside an input/textarea/select
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        if (!e.key.startsWith('F') || e.key === 'F5') return
      }

      const key = normalizeKey(e)
      const stack = handlerStacks.get(key)

      if (stack && stack.length > 0) {
        // Prevent default browser actions for function keys and registered shortcuts
        if (e.key.startsWith('F')) e.preventDefault()
        if (e.ctrlKey || e.altKey) e.preventDefault()
        
        // Execute the most recently registered active handler on the stack
        const topHandler = stack[stack.length - 1]
        topHandler()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  const register = useCallback((key: string, handler: HotkeyHandler) => {
    let stack = handlerStacks.get(key)
    if (!stack) {
      stack = []
      handlerStacks.set(key, stack)
    }
    stack.push(handler)

    // Cleanup function that removes only this specific handler
    return () => {
      const currentStack = handlerStacks.get(key)
      if (currentStack) {
        const idx = currentStack.indexOf(handler)
        if (idx !== -1) {
          currentStack.splice(idx, 1)
        }
        if (currentStack.length === 0) {
          handlerStacks.delete(key)
        }
      }
    }
  }, [])

  return (
    <HotkeyContext.Provider value={{ register }}>
      {children}
    </HotkeyContext.Provider>
  )
}

export function useHotkeys(bindings: Record<string, HotkeyHandler>) {
  const ctx = useContext(HotkeyContext)
  if (!ctx) throw new Error('useHotkeys must be used within HotkeyProvider')

  const { register } = ctx
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  useEffect(() => {
    const keys = Object.keys(bindingsRef.current)
    const unregisters: (() => void)[] = []

    for (const key of keys) {
      const unreg = register(key, () => {
        bindingsRef.current[key]?.()
      })
      unregisters.push(unreg)
    }

    return () => {
      unregisters.forEach(fn => fn())
    }
  }, [register])
}
