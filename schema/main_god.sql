CREATE TABLE IF NOT EXISTS main_god (
  account TEXT PRIMARY KEY,          -- 유저 계정 주소 (지갑 주소 등)
  god_id TEXT NOT NULL,              -- 메인 God 식별자
  selected_at INTEGER NOT NULL       -- 선택한 시각 (Unix time)
);
