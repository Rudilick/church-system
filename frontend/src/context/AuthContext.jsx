import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
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
      // JWT 고정값 대신 최신 church_name 등을 DB에서 갱신
      const base = import.meta.env.VITE_API_URL ?? '/api'
      fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUser(prev => ({ ...prev, ...data })) })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
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

  // 설정 변경 후 JWT 재발급 없이 최신 church_name 등을 반영
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const base = import.meta.env.VITE_API_URL ?? '/api'
      const res = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setUser(prev => ({ ...prev, ...data }))
    } catch {}
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
