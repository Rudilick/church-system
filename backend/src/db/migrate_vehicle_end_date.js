import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 vehicle_dispatches.end_date 컬럼 추가 중...')

  await pool.query(`
    ALTER TABLE vehicle_dispatches
      ADD COLUMN IF NOT EXISTS end_date DATE
  `)
  await pool.query(`
    UPDATE vehicle_dispatches SET end_date = dispatch_date WHERE end_date IS NULL
  `)
  await pool.query(`
    ALTER TABLE vehicle_dispatches
      ALTER COLUMN end_date SET NOT NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_end_date
      ON vehicle_dispatches(end_date)
  `)
  console.log('✅ vehicle_dispatches.end_date 컬럼 추가 완료')

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
