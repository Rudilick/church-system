import pool from './pool.js'

async function run() {
  const client = await pool.connect()
  try {
    await client.query(
      `ALTER TABLE offerings ADD COLUMN IF NOT EXISTS name VARCHAR(100)`
    )
    console.log('✅ offerings.name 컬럼 추가 완료')
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
