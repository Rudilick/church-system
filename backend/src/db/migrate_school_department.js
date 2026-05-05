import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 school_department 컬럼 추가 중...')

  await pool.query(`
    ALTER TABLE members
      ADD COLUMN IF NOT EXISTS school_department VARCHAR(100)
  `)
  console.log('✅ members.school_department 컬럼 추가 완료')

  await pool.query(`
    INSERT INTO enum_values (church_id, enum_type, value, sort_order)
    VALUES (1, 'school_department', '유치부', 10)
    ON CONFLICT DO NOTHING
  `).catch(() => {})

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
