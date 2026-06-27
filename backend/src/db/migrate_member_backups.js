import pool from './pool.js'
import dotenv from 'dotenv'
dotenv.config()

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_backups (
      id           SERIAL PRIMARY KEY,
      backup_type  VARCHAR(10) CHECK (backup_type IN ('daily', 'monthly')),
      backup_date  DATE        NOT NULL,
      member_count INT         NOT NULL DEFAULT 0,
      data         JSONB       NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (backup_type, backup_date)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_member_backups_type_date
    ON member_backups(backup_type, backup_date DESC)
  `)
  console.log('member_backups 테이블 생성 완료')
  await pool.end()
}

migrate().catch(err => { console.error(err); process.exit(1) })
