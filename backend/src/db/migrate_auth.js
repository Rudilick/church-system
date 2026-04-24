import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 Auth 마이그레이션 시작...')

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_user_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS picture        VARCHAR(500),
      ADD COLUMN IF NOT EXISTS role           VARCHAR(50) DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS church_id      INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS department     VARCHAR(100),
      ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW()
  `)
  console.log('✅ users 컬럼 추가 완료')

  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`).catch(() => {
    console.log('⚠️  password_hash 이미 nullable이거나 컬럼 없음 (무시)')
  })

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_google_user_id_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_google_user_id_key UNIQUE (google_user_id);
      END IF;
    END $$
  `)
  console.log('✅ google_user_id UNIQUE 제약 완료')

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_google_user_id ON users(google_user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
  console.log('✅ 인덱스 생성 완료')

  console.log('')
  console.log('🎉 마이그레이션 완료!')
  console.log('')
  console.log('📝 최초 super_admin 등록 SQL:')
  console.log(`INSERT INTO users (email, name, google_user_id, role, church_id, is_active)`)
  console.log(`VALUES ('<gmail>', '<이름>', '<Google sub>', 'super_admin', 1, true);`)
  console.log('')
  console.log('💡 Google sub 값은 아직 모르면, 먼저 로그인 시도 후 서버 콘솔에서 확인하세요.')

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
