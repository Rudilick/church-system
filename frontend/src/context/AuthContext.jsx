import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function isTokenValid(token) {
  const payload = parseJwt(token)
  if (!payload) return false
  return payload.exp * 1000 > Date.now()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token && isTokenValid(token)) {
      setUser(parseJwt(token))
    }
    setLoading(false)
  }, [])

  const login = useCallback((token) => {
    localStorage.setItem('token', token)
    setUser(parseJwt(token))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    // Google One Tap 세션도 해제
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
