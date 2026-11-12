import type Database from 'better-sqlite3';

const safe = '9007199254740991';
const uuid = (column: string) => `length(${column})=36 AND substr(${column},9,1)='-' AND substr(${column},14,1)='-' AND substr(${column},19,1)='-' AND substr(${column},24,1)='-' AND length(replace(${column},'-',''))=32 AND replace(${column},'-','') NOT GLOB '*[^0-9a-f]*'`;
const jsonObject = (column: string) => `CASE WHEN json_valid(${column}) THEN json_type(${column})='object' ELSE 0 END`;

/** Additive global schema 3; no library rows, classifications or assets are rewritten. */
export function addGameSchema(db: Database.Database): void {
  db.exec(`
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK (${uuid('id')}),
  status TEXT NOT NULL CHECK (status IN ('setup','active','completed','discarded')),
  rules_version INTEGER NOT NULL CHECK (rules_version=1),
  state_version INTEGER NOT NULL CHECK (state_version BETWEEN 1 AND ${safe}),
  active_contestant_id TEXT,
  current_round_id TEXT,
  next_attempt_ordinal INTEGER NOT NULL CHECK (next_attempt_ordinal BETWEEN 1 AND ${safe}),
  next_turn_ordinal INTEGER NOT NULL CHECK (next_turn_ordinal BETWEEN 1 AND 1001),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT,
  CHECK ((status IN ('completed','discarded')) = (completed_at IS NOT NULL)),
  CHECK (status NOT IN ('setup','discarded') OR current_round_id IS NULL),
  CHECK (status NOT IN ('active','completed') OR active_contestant_id IS NOT NULL),
  FOREIGN KEY(id,active_contestant_id) REFERENCES game_contestants(session_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(id,current_round_id) REFERENCES game_rounds(session_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE UNIQUE INDEX game_one_nonterminal ON game_sessions((1)) WHERE status IN ('setup','active');
CREATE TABLE game_contestants (
  id TEXT PRIMARY KEY NOT NULL CHECK (${uuid('id')}),
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  name_key TEXT NOT NULL CHECK (length(name_key)>0),
  ordinal INTEGER NOT NULL CHECK (ordinal IN (0,1)),
  UNIQUE(session_id,id), UNIQUE(session_id,ordinal), UNIQUE(session_id,name_key)
) STRICT;
CREATE TABLE game_rounds (
  id TEXT PRIMARY KEY NOT NULL CHECK (${uuid('id')}),
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE RESTRICT,
  contestant_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 1 AND ${safe}),
  requested_tier TEXT NOT NULL CHECK (requested_tier IN ('squash','competitive','deathmatch')),
  phase TEXT NOT NULL CHECK (phase IN ('preparing','ready','guessing','paused','awaiting_judgment','interrupted','adjudicated','answer_revealed','cancelled')),
  context_json TEXT CHECK (context_json IS NULL OR ${jsonObject('context_json')}),
  screenshot_id TEXT REFERENCES screenshots(id) ON DELETE RESTRICT,
  match_id TEXT REFERENCES matches(id) ON DELETE RESTRICT,
  image_sha256 TEXT CHECK (image_sha256 IS NULL OR (length(image_sha256)=64 AND image_sha256 NOT GLOB '*[^0-9a-f]*')),
  timer_generation INTEGER NOT NULL CHECK (timer_generation BETWEEN 0 AND ${safe}),
  window_ms REAL CHECK (window_ms > 0 AND window_ms <= 10000),
  remaining_ms REAL CHECK (remaining_ms > 0 AND remaining_ms <= 10000),
  pause_reason TEXT CHECK (pause_reason IN ('host','primary-display','host-connection')),
  exposed_at TEXT,
  turn_ordinal INTEGER CHECK (turn_ordinal BETWEEN 1 AND 1000),
  outcome TEXT CHECK (outcome IN ('correct','incorrect','timeout','void')),
  award INTEGER CHECK (award IN (0,1,2,3)),
  late_entry INTEGER NOT NULL DEFAULT 0 CHECK (late_entry IN (0,1)),
  void_reason TEXT CHECK (void_reason IN ('skip','void','interrupted')),
  cancel_reason TEXT CHECK (cancel_reason IN ('host','preparation-failed','recovery')),
  judged_at TEXT, created_at TEXT NOT NULL,
  UNIQUE(session_id,id), UNIQUE(session_id,id,contestant_id), UNIQUE(session_id,ordinal), UNIQUE(session_id,turn_ordinal),
  FOREIGN KEY(session_id,contestant_id) REFERENCES game_contestants(session_id,id) ON DELETE RESTRICT,
  CHECK ((context_json IS NULL) = (screenshot_id IS NULL) AND (context_json IS NULL) = (match_id IS NULL) AND (context_json IS NULL) = (image_sha256 IS NULL)),
  CHECK (context_json IS NULL OR (json_extract(context_json,'$.screenshotId') IS screenshot_id AND json_extract(context_json,'$.matchId') IS match_id AND json_extract(context_json,'$.image.sha256') IS image_sha256 AND json_extract(context_json,'$.rulesVersion') IS 1)),
  CHECK (phase IN ('preparing','cancelled') OR context_json IS NOT NULL),
  CHECK (phase!='preparing' OR context_json IS NULL),
  CHECK ((exposed_at IS NOT NULL) = (turn_ordinal IS NOT NULL)),
  CHECK ((phase IN ('guessing','paused','awaiting_judgment','interrupted','adjudicated','answer_revealed')) = (exposed_at IS NOT NULL)),
  CHECK ((phase='guessing') = (window_ms IS NOT NULL)),
  CHECK ((phase='paused') = (remaining_ms IS NOT NULL) AND (phase='paused') = (pause_reason IS NOT NULL)),
  CHECK ((phase IN ('adjudicated','answer_revealed')) = (outcome IS NOT NULL) AND (outcome IS NULL) = (award IS NULL) AND (outcome IS NULL) = (judged_at IS NULL)),
  CHECK (outcome IS NULL OR (outcome='correct' AND award IN (1,2,3)) OR (outcome!='correct' AND award=0)),
  CHECK (outcome IS NOT 'correct' OR award=CASE requested_tier WHEN 'squash' THEN 1 WHEN 'competitive' THEN 2 WHEN 'deathmatch' THEN 3 END),
  CHECK (late_entry=0 OR outcome='correct'), CHECK ((outcome IS 'void') = (void_reason IS NOT NULL)),
  CHECK ((phase='cancelled') = (cancel_reason IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX game_used_match ON game_rounds(session_id,match_id) WHERE exposed_at IS NOT NULL;
CREATE UNIQUE INDEX game_used_screenshot ON game_rounds(session_id,screenshot_id) WHERE exposed_at IS NOT NULL;
CREATE UNIQUE INDEX game_used_hash ON game_rounds(session_id,image_sha256) WHERE exposed_at IS NOT NULL;
CREATE INDEX game_round_history ON game_rounds(session_id,ordinal);
CREATE TABLE game_score_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (${uuid('id')}), session_id TEXT NOT NULL,
  round_id TEXT NOT NULL UNIQUE, contestant_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount IN (1,2,3)), created_at TEXT NOT NULL,
  FOREIGN KEY(session_id,round_id,contestant_id) REFERENCES game_rounds(session_id,id,contestant_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX game_score_totals ON game_score_events(session_id,contestant_id);
CREATE TABLE game_command_receipts (
  command_id TEXT PRIMARY KEY NOT NULL CHECK (${uuid('command_id')}),
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE RESTRICT,
  round_id TEXT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint)=64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  accepted_version INTEGER NOT NULL CHECK (accepted_version BETWEEN 1 AND ${safe}),
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id,round_id) REFERENCES game_rounds(session_id,id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX game_receipts_session ON game_command_receipts(session_id);
CREATE TRIGGER game_round_owner_immutable BEFORE UPDATE OF contestant_id,session_id,ordinal,requested_tier ON game_rounds
WHEN NEW.contestant_id IS NOT OLD.contestant_id OR NEW.session_id IS NOT OLD.session_id OR NEW.ordinal IS NOT OLD.ordinal OR NEW.requested_tier IS NOT OLD.requested_tier
BEGIN SELECT RAISE(ABORT,'Round ownership is immutable'); END;
CREATE TRIGGER game_round_context_immutable BEFORE UPDATE ON game_rounds
WHEN (OLD.context_json IS NOT NULL AND NEW.context_json IS NOT OLD.context_json)
 OR (OLD.exposed_at IS NOT NULL AND (NEW.exposed_at IS NOT OLD.exposed_at OR NEW.turn_ordinal IS NOT OLD.turn_ordinal))
 OR (OLD.outcome IS NOT NULL AND (NEW.outcome IS NOT OLD.outcome OR NEW.award IS NOT OLD.award OR NEW.late_entry IS NOT OLD.late_entry OR NEW.void_reason IS NOT OLD.void_reason OR NEW.judged_at IS NOT OLD.judged_at))
BEGIN SELECT RAISE(ABORT,'Round history is immutable'); END;
CREATE TRIGGER game_round_no_delete BEFORE DELETE ON game_rounds BEGIN SELECT RAISE(ABORT,'Retain round history'); END;
CREATE TRIGGER game_score_check BEFORE INSERT ON game_score_events
WHEN NOT EXISTS (SELECT 1 FROM game_rounds WHERE id=NEW.round_id AND session_id=NEW.session_id AND contestant_id=NEW.contestant_id AND outcome='correct' AND award=NEW.amount)
BEGIN SELECT RAISE(ABORT,'Award must match judged round'); END;
CREATE TRIGGER game_score_no_update BEFORE UPDATE ON game_score_events BEGIN SELECT RAISE(ABORT,'Awards are immutable'); END;
CREATE TRIGGER game_score_no_delete BEFORE DELETE ON game_score_events BEGIN SELECT RAISE(ABORT,'Retain awards'); END;
CREATE TRIGGER game_receipt_no_update BEFORE UPDATE ON game_command_receipts BEGIN SELECT RAISE(ABORT,'Receipts are immutable'); END;
CREATE TRIGGER game_receipt_no_delete BEFORE DELETE ON game_command_receipts BEGIN SELECT RAISE(ABORT,'Retain receipts'); END;
`);
}

/** Schema 4: rebuild only timing CHECKs, inside the runner's FK-off transaction. */
export function extendGuessingWindow(db: Database.Database): void {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='game_rounds'").get() as { sql: string } | undefined;
  if (!row) throw new Error('Missing game rounds schema for timing upgrade');
  let bounds = 0;
  const schema = row.sql.replace(/^CREATE TABLE (?:"game_rounds"|game_rounds)/i, 'CREATE TABLE game_rounds_next')
    .replace(/\b(window_ms|remaining_ms)\s*<=\s*10000\b/g, (_match, column: string) => { bounds++; return `${column} <= 30000`; });
  if (bounds !== 2 || !schema.startsWith('CREATE TABLE game_rounds_next')) throw new Error('Unexpected game rounds timing schema; upgrade refused');
  const objects = db.prepare(`SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND
    ((type='index' AND tbl_name='game_rounds') OR
    (type='trigger' AND (tbl_name='game_rounds' OR instr(lower(sql),'game_rounds')>0))) ORDER BY type,name`).all() as Array<{ type: string; name: string; sql: string }>;
  const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
  const columns = (db.pragma('table_info(game_rounds)') as Array<{ name: string }>).map(({ name }) => quote(name)).join(',');
  db.exec(schema);
  db.exec(`INSERT INTO game_rounds_next (${columns}) SELECT ${columns} FROM game_rounds`);
  // Dependent triggers must not refer to a temporarily absent table during rename.
  for (const object of objects) if (object.type === 'trigger') db.exec(`DROP TRIGGER ${quote(object.name)}`);
  db.exec('DROP TABLE game_rounds; ALTER TABLE game_rounds_next RENAME TO game_rounds');
  for (const object of objects) db.exec(object.sql);
}
