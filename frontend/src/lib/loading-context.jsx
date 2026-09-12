import { createContext, useCallback, useContext, useState } from 'react'

const LoadingContext = createContext(null)

// One shared "is anything busy right now" flag for the whole app. While an
// action is running, every LoadingButton disables itself; only the one
// whose id matches `pendingId` shows a spinner. Prevents double-submits
// (double-click, or clicking a second action before the first resolves).
export function LoadingProvider({ children }) {
  const [pendingId, setPendingId] = useState(null)

  const run = useCallback(async (id, fn) => {
    setPendingId(id)
    try {
      return await fn()
    } finally {
      setPendingId(null)
    }
  }, [])

  return <LoadingContext.Provider value={{ pendingId, run }}>{children}</LoadingContext.Provider>
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (!context) throw new Error('useLoading must be used within a LoadingProvider')
  return context
}
