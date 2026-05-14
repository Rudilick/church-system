import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 home_phone 컬럼 추가 중...')

  await pool.query(`
    ALTER TABLE members
      ADD COLUMN IF NOT EXISTS home_phone VARCHAR(30)
  `)
  console.log('✅ members.home_phone 컬럼 추가 완료')

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
