import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 문자 발송과 동일한 권한 (관리자 전용)
const TEMPLATE_ROLES = ['super_admin', 'church_admin', 'pastor', 'teacher', 'finance']

// ── 발송 가능한 템플릿 목록 (승인 + 활성 상태만) ───────────────────
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM kakao_templates WHERE is_active = true AND status = 'APPROVED' ORDER BY name`
  )
  res.json(rows)
})

// ── 템플릿 등록 — 솔라피/카카오 콘솔에서 승인받은 템플릿 코드를 수동 등록 ──
router.post('/', async (req, res) => {
  if (!TEMPLATE_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: '템플릿 등록 권한이 없습니다.' })
  }
  const { template_id, name, content, variables, pf_id, status } = req.body
  if (!template_id?.trim() || !name?.trim() || !content?.trim()) {
    return res.status(400).json({ error: '템플릿 코드, 이름, 내용은 필수입니다.' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO kakao_templates (template_id, name, content, variables, pf_id, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [template_id.trim(), name.trim(), content.trim(), JSON.stringify(variables ?? []), pf_id || null, status || 'APPROVED']
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 템플릿 수정 (활성화/비활성화 등) ────────────────────────────────
router.patch('/:id', async (req, res) => {
  if (!TEMPLATE_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: '템플릿 수정 권한이 없습니다.' })
  }
  const { name, is_active, status } = req.body
  const { rows } = await pool.query(
    `UPDATE kakao_templates SET
       name      = COALESCE($1, name),
       is_active = COALESCE($2, is_active),
       status    = COALESCE($3, status)
     WHERE id = $4 RETURNING *`,
    [name ?? null, is_active ?? null, status ?? null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' })
  res.json(rows[0])
})

export default router
