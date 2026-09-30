import React, { createContext, useContext, useEffect, useCallback, ReactNode, useRef } from 'react'

type HotkeyHandler = () => void

interface HotkeyRegistration {
  id: number
  priority: number
  handler: HotkeyHandler
}

interface HotkeyContextType {
  register: (key: string, handler: HotkeyHandler, priority?: number) => () => void
}

const HotkeyContext = createContext<HotkeyContextType | null>(null)

let nextRegistrationId = 0
// Stack of handlers for each hotkey with priority support (e.g., shell=0, page=10, modal=20)
const handlerStacks = new Map<string, HotkeyRegistration[]>()

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
        
        // Execute the highest priority handler; if tied, most recently registered (highest id)
        let top = stack[0]
        for (let i = 1; i < stack.length; i++) {
          const item = stack[i]
          if (item.priority > top.priority || (item.priority === top.priority && item.id > top.id)) {
            top = item
          }
        }
        top.handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  const register = useCallback((key: string, handler: HotkeyHandler, priority: number = 10) => {
    let stack = handlerStacks.get(key)
    if (!stack) {
      stack = []
      handlerStacks.set(key, stack)
    }
    const reg: HotkeyRegistration = { id: ++nextRegistrationId, priority, handler }
    stack.push(reg)

    // Cleanup function that removes only this specific handler
    return () => {
      const currentStack = handlerStacks.get(key)
      if (currentStack) {
        const idx = currentStack.findIndex(r => r.id === reg.id)
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

export function useHotkeys(
  bindings: Record<string, HotkeyHandler>,
  options?: { priority?: number }
) {
  const ctx = useContext(HotkeyContext)
  if (!ctx) throw new Error('useHotkeys must be used within HotkeyProvider')

  const { register } = ctx
  const priority = options?.priority ?? 10
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  useEffect(() => {
    const keys = Object.keys(bindingsRef.current)
    const unregisters: (() => void)[] = []

    for (const key of keys) {
      const unreg = register(key, () => {
        bindingsRef.current[key]?.()
      }, priority)
      unregisters.push(unreg)
    }

    return () => {
      unregisters.forEach(fn => fn())
    }
  }, [register, priority])
}
