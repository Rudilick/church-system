import dotenv from 'dotenv'
import sharp from 'sharp'
import pool from './pool.js'

dotenv.config()

const THUMB_SIZE = 120
const THUMB_QUALITY = 60

async function migrate() {
  console.log('🔄 기존 멤버 사진 썸네일 백필 시작...')

  const { rows } = await pool.query(`
    SELECT id, photo_url FROM members
    WHERE photo_url IS NOT NULL AND photo_url != ''
      AND (photo_thumb_url IS NULL OR photo_thumb_url = '')
  `)
  console.log(`대상: ${rows.length}명`)

  let success = 0
  let skipped = 0

  for (const { id, photo_url } of rows) {
    const match = photo_url.match(/^data:image\/\w+;base64,(.+)$/)
    if (!match) {
      console.warn(`⚠️ id=${id} data URL 형식이 아님 — 건너뜀`)
      skipped++
      continue
    }
    try {
      const buffer = Buffer.from(match[1], 'base64')
      const thumbBuffer = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer()
      const thumbUrl = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`
      await pool.query(`UPDATE members SET photo_thumb_url = $1 WHERE id = $2`, [thumbUrl, id])
      success++
    } catch (err) {
      console.error(`❌ id=${id} 처리 실패:`, err.message)
      skipped++
    }
  }

  console.log(`✅ 완료: ${success}명 처리, ${skipped}명 건너뜀`)
  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
