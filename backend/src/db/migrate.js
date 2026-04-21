import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pool from './pool.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  const client = await pool.connect()
  try {
    await client.query(sql)
    console.log('✅ 마이그레이션 완료')
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
