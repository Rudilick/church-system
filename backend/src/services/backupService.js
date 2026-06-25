import pool from '../db/pool.js'

export async function createBackup(type) {
  const { rows: members } = await pool.query('SELECT * FROM members ORDER BY id')
  const date = new Date().toISOString().slice(0, 10)

  await pool.query(
    `INSERT INTO member_backups (backup_type, backup_date, member_count, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (backup_type, backup_date) DO UPDATE SET
       member_count = EXCLUDED.member_count,
       data         = EXCLUDED.data,
       created_at   = NOW()`,
    [type, date, members.length, JSON.stringify(members)]
  )

  console.log(`[backup] ${type} 백업 완료: ${date} (${members.length}명)`)
}

export async function cleanupBackups() {
  const { rowCount: d } = await pool.query(
    `DELETE FROM member_backups
     WHERE backup_type = 'daily' AND backup_date < CURRENT_DATE - INTERVAL '7 days'`
  )
  const { rowCount: m } = await pool.query(
    `DELETE FROM member_backups
     WHERE backup_type = 'monthly' AND backup_date < CURRENT_DATE - INTERVAL '12 months'`
  )
  if (d > 0 || m > 0) console.log(`[backup] 정리 완료: 일별 ${d}건, 월별 ${m}건 삭제`)
}
