import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

async function migrate() {
  console.log('🔄 차량배차 테이블 생성 중...')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      plate         VARCHAR(20)  NOT NULL,
      capacity      INT,
      manager_phone VARCHAR(20),
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('✅ vehicles 테이블 생성 완료')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_dispatches (
      id                  SERIAL PRIMARY KEY,
      vehicle_id          INT REFERENCES vehicles(id) ON DELETE CASCADE,
      requester_name      VARCHAR(100) NOT NULL,
      requester_phone     VARCHAR(20)  NOT NULL,
      department          VARCHAR(100),
      purpose             VARCHAR(300) NOT NULL,
      dispatch_date       DATE NOT NULL,
      start_time          TIME NOT NULL,
      end_time            TIME NOT NULL,
      passenger_count     INT,
      memo                VARCHAR(500),
      status              VARCHAR(20) DEFAULT 'pending',
      rejected_reason     VARCHAR(300),
      notified_day_before BOOLEAN DEFAULT false,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('✅ vehicle_dispatches 테이블 생성 완료')

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_date
      ON vehicle_dispatches(dispatch_date)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_vehicle
      ON vehicle_dispatches(vehicle_id)
  `)
  console.log('✅ 인덱스 생성 완료')

  await pool.end()
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err)
  process.exit(1)
})
