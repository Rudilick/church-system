import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' })
  }
  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '토큰이 만료됐거나 유효하지 않습니다.' })
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '권한이 없습니다.' })
    }
    next()
  }
}
