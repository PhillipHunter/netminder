export const USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const NETS_TABLE = `
CREATE TABLE IF NOT EXISTS nets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT,
  ended_at TEXT,
  formal_ended_at TEXT,
  topic TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const STATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callsign TEXT NOT NULL UNIQUE COLLATE NOCASE,
  preferred_name TEXT,
  location TEXT,
  notes TEXT,
  qrz_data TEXT,
  qrz_last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CHECKINS_TABLE = `
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  net_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  callsign TEXT NOT NULL,
  display_name TEXT,
  time_entered TEXT NOT NULL DEFAULT (datetime('now')),
  mobility TEXT NOT NULL CHECK(mobility IN ('neither', 'mobile', 'portable')) DEFAULT 'neither',
  staying INTEGER NOT NULL DEFAULT 0,
  called_back INTEGER NOT NULL DEFAULT 0,
  topic_answer TEXT,
  operator_notes TEXT,
  FOREIGN KEY (net_id) REFERENCES nets(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT
)`;

export const STATIONS_CALLSIGN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_stations_callsign
ON stations(callsign)`;

export const CHECKINS_NET_ID_INDEX = `
CREATE INDEX IF NOT EXISTS idx_checkins_net_id
ON checkins(net_id)`;

export const CHECKINS_STATION_ID_INDEX = `
CREATE INDEX IF NOT EXISTS idx_checkins_station_id
ON checkins(station_id)`;

export const CHECKINS_COMPOSITE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_checkins_station_time
ON checkins(station_id, time_entered)`;

export const SCHEMA_STATEMENTS = [
    USERS_TABLE,
    SETTINGS_TABLE,
    NETS_TABLE,
    STATIONS_TABLE,
    CHECKINS_TABLE,
    STATIONS_CALLSIGN_INDEX,
    CHECKINS_NET_ID_INDEX,
    CHECKINS_STATION_ID_INDEX,
    CHECKINS_COMPOSITE_INDEX
];