-- ============================================================
-- 교회 관리 시스템 — PostgreSQL 스키마
-- ============================================================

-- 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 인증 파트
-- ============================================================

CREATE TABLE roles (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(50) UNIQUE NOT NULL, -- admin, pastor, staff, section_leader
  label     VARCHAR(100)
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role_id       INT REFERENCES roles(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 교적 파트
-- ============================================================

CREATE TABLE members (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),                    -- 영문 이름 (동명이인 구분 보조)
  gender          CHAR(1) CHECK (gender IN ('M','F')),
  birth_date      DATE,
  birth_lunar     BOOLEAN DEFAULT FALSE,           -- 음력 생일 여부
  phone           VARCHAR(20),
  email           VARCHAR(255),
  address         VARCHAR(500),
  address_detail  VARCHAR(255),
  lat             NUMERIC(10,7),                   -- 지도 좌표
  lng             NUMERIC(10,7),
  workplace       VARCHAR(255),
  school          VARCHAR(255),
  photo_url       VARCHAR(500),
  membership_type VARCHAR(50) DEFAULT 'active',    -- active, inactive, transfer_out, deceased
  registered_at   DATE,
  baptism_date    DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE families (
  id                 SERIAL PRIMARY KEY,
  member_id          INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  related_member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  relation_type      VARCHAR(50) NOT NULL, -- spouse, parent, child, sibling, etc.
  UNIQUE (member_id, related_member_id)
);

-- ============================================================
-- 공동체 / 구역 파트
-- ============================================================

CREATE TABLE communities (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(50),  -- district(지구), region(지역), community(공동체), women_group(여전도회) 등
  parent_id   INT REFERENCES communities(id),  -- 상위 공동체 (지구 > 지역 구조)
  leader_id   INT REFERENCES members(id),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE member_communities (
  id           SERIAL PRIMARY KEY,
  member_id    INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  role         VARCHAR(50) DEFAULT 'member', -- leader, deputy, member
  joined_at    DATE,
  UNIQUE (member_id, community_id)
);

-- ============================================================
-- 부서 파트
-- ============================================================

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE department_members (
  id            SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  member_id     INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role          VARCHAR(50) DEFAULT 'member',
  UNIQUE (department_id, member_id)
);

-- ============================================================
-- 예배 / 출결 파트
-- ============================================================

CREATE TABLE services (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,  -- 주일1부, 주일2부, 수요예배, 새벽예배 등
  day_of_week SMALLINT,               -- 0=일, 1=월, ..., 6=토
  start_time  TIME,
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE attendances (
  id         SERIAL PRIMARY KEY,
  member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES services(id),
  date       DATE NOT NULL,
  method     VARCHAR(20) DEFAULT 'manual', -- manual, qr
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, service_id, date)
);

CREATE TABLE qr_tokens (
  id         SERIAL PRIMARY KEY,
  member_id  INT UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token      VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 헌금 파트
-- ============================================================

CREATE TABLE offering_types (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,  -- 십일조, 감사헌금, 건축헌금, 선교헌금 등
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE offerings (
  id               SERIAL PRIMARY KEY,
  member_id        INT REFERENCES members(id),  -- NULL 허용 (무명 헌금)
  name             VARCHAR(100),                -- member_id 없을 때 자유 입력 이름
  offering_type_id INT NOT NULL REFERENCES offering_types(id),
  amount           NUMERIC(12,0) NOT NULL,
  date             DATE NOT NULL,
  memo             TEXT,
  created_by       INT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 예산 / 장부 파트
-- ============================================================

CREATE TABLE fiscal_years (
  id         SERIAL PRIMARY KEY,
  year       SMALLINT UNIQUE NOT NULL,
  is_closed  BOOLEAN DEFAULT FALSE,
  closed_at  TIMESTAMPTZ
);

CREATE TABLE budget_categories (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  type           CHAR(1) CHECK (type IN ('I','E')),  -- I=수입, E=지출
  department_id  INT REFERENCES departments(id),
  fiscal_year_id INT REFERENCES fiscal_years(id),
  budget_amount  NUMERIC(14,0) DEFAULT 0
);

CREATE TABLE transactions (
  id                  SERIAL PRIMARY KEY,
  budget_category_id  INT REFERENCES budget_categories(id),
  type                CHAR(1) CHECK (type IN ('I','E')),
  amount              NUMERIC(14,0) NOT NULL,
  date                DATE NOT NULL,
  memo                TEXT,
  fiscal_year_id      INT REFERENCES fiscal_years(id),
  created_by          INT REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE receipts (
  id             SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_url       VARCHAR(500) NOT NULL,
  file_name      VARCHAR(255),
  uploaded_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 소통 파트
-- ============================================================

CREATE TABLE pastoral_visits (
  id         SERIAL PRIMARY KEY,
  member_id  INT NOT NULL REFERENCES members(id),
  pastor_id  INT NOT NULL REFERENCES users(id),
  visit_date DATE NOT NULL,
  content    TEXT,
  is_private BOOLEAN DEFAULT FALSE,  -- 담임목사 전용 열람
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  department_id   INT REFERENCES departments(id),
  location        VARCHAR(255),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  is_all_day      BOOLEAN DEFAULT FALSE,
  recurrence_rule VARCHAR(255),  -- RRULE 형식 (FREQ=WEEKLY;BYDAY=SU 등)
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_rooms (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),         -- 그룹 채팅방 이름 (1:1은 NULL)
  is_group   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_room_members (
  room_id   INT NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE messages (
  id         SERIAL PRIMARY KEY,
  room_id    INT NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  sender_id  INT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  file_url   VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_reads (
  message_id INT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE sms_logs (
  id           SERIAL PRIMARY KEY,
  sender_id    INT REFERENCES users(id),
  target_type  VARCHAR(50),  -- all, community, department, individual
  target_id    INT,
  recipient_count INT,
  message      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  status       VARCHAR(20) DEFAULT 'sent'
);

-- ============================================================
-- 인덱스
-- ============================================================

CREATE INDEX idx_members_name       ON members(name);
CREATE INDEX idx_members_birth_date ON members(birth_date);
CREATE INDEX idx_attendances_date   ON attendances(date);
CREATE INDEX idx_attendances_member ON attendances(member_id);
CREATE INDEX idx_offerings_date     ON offerings(date);
CREATE INDEX idx_offerings_member   ON offerings(member_id);
CREATE INDEX idx_transactions_date  ON transactions(date);
CREATE INDEX idx_events_start       ON events(start_at);
CREATE INDEX idx_messages_room      ON messages(room_id, created_at);

-- ============================================================
-- 기본 데이터
-- ============================================================

INSERT INTO roles (name, label) VALUES
  ('admin',          '시스템 관리자'),
  ('pastor',         '교역자'),
  ('staff',          '직원'),
  ('section_leader', '구역장');

INSERT INTO services (name, day_of_week, start_time) VALUES
  ('주일 1부 예배', 0, '09:00'),
  ('주일 2부 예배', 0, '11:00'),
  ('주일 3부 예배', 0, '14:00'),
  ('수요 예배',     3, '19:30'),
  ('새벽 예배',     NULL, '05:30');

INSERT INTO offering_types (name) VALUES
  ('주정헌금'),
  ('십일조헌금'),
  ('감사헌금'),
  ('건축헌금'),
  ('선교헌금'),
  ('구제헌금'),
  ('절기헌금'),
  ('특별헌금'),
  ('교육헌금'),
  ('구역헌금'),
  ('봉헌'),
  ('장학헌금');

INSERT INTO fiscal_years (year) VALUES (2025), (2026);
