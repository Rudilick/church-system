import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 churches 테이블 생성 중...')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS churches (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '우리 교회',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `)
  console.log('✅ churches 테이블 생성 완료')

  await pool.query(`
    INSERT INTO churches (id, name)
    VALUES (1, '우리 교회')
    ON CONFLICT (id) DO NOTHING
  `)
  console.log('✅ 기본 교회 (id=1) 삽입 완료')

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
