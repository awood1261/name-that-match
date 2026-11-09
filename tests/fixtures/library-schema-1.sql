
CREATE TABLE matches (
  id TEXT PRIMARY KEY NOT NULL,
  participant_description TEXT,
  promotion TEXT,
  event TEXT,
  match_date TEXT,
  obscurity TEXT CHECK (obscurity IN ('iconic', 'familiar', 'obscure')),
  stipulation TEXT,
  championship_info TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0 AND revision <= 9007199254740991)
) STRICT;

CREATE TABLE screenshots (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT REFERENCES matches(id) ON DELETE RESTRICT,
  capture_id TEXT NOT NULL CHECK (length(trim(capture_id)) > 0),
  source_platform TEXT NOT NULL CHECK (source_platform = 'youtube'),
  source_video_id TEXT NOT NULL CHECK (length(trim(source_video_id)) > 0),
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  source_title TEXT,
  playback_seconds REAL NOT NULL CHECK (playback_seconds >= 0 AND playback_seconds <= 1.7976931348623157e308),
  captured_at TEXT NOT NULL,
  capture_method TEXT NOT NULL CHECK (capture_method = 'video-frame-capture'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  original_metadata_json TEXT NOT NULL CHECK (CASE WHEN json_valid(original_metadata_json) THEN json_type(original_metadata_json) = 'object' ELSE 0 END),
  image_path TEXT NOT NULL UNIQUE CHECK (image_path = 'screenshots/' || id || '.png'),
  image_sha256 TEXT NOT NULL CHECK (length(image_sha256) = 64 AND image_sha256 NOT GLOB '*[^0-9a-f]*'),
  image_width INTEGER NOT NULL CHECK (image_width > 0 AND image_width <= 9007199254740991),
  image_height INTEGER NOT NULL CHECK (image_height > 0 AND image_height <= 9007199254740991),
  image_byte_size INTEGER NOT NULL CHECK (image_byte_size > 0 AND image_byte_size <= 9007199254740991),
  difficulty TEXT CHECK (difficulty IN ('squash', 'competitive', 'deathmatch')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0 AND revision <= 9007199254740991),
  UNIQUE (source_platform, capture_id),
  CHECK (review_status != 'approved' OR (match_id IS NOT NULL AND difficulty IS NOT NULL))
) STRICT;
CREATE INDEX screenshots_match_id ON screenshots(match_id);
CREATE INDEX screenshots_image_sha256 ON screenshots(image_sha256);

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  source_label TEXT NOT NULL CHECK (length(trim(source_label)) BETWEEN 1 AND 255),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'validating', 'preview_ready', 'confirming', 'completed', 'partial_success', 'failed', 'interrupted', 'expired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  preview_token TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0 AND revision <= 9007199254740991),
  confirmation_receipts_json TEXT NOT NULL DEFAULT '{}' CHECK (CASE WHEN json_valid(confirmation_receipts_json) THEN json_type(confirmation_receipts_json) = 'object' ELSE 0 END),
  ignored_files_json TEXT NOT NULL DEFAULT '[]' CHECK (CASE WHEN json_valid(ignored_files_json) THEN json_type(ignored_files_json) = 'array' ELSE 0 END),
  last_error_code TEXT,
  last_error_message TEXT,
  retryable INTEGER NOT NULL DEFAULT 0 CHECK (retryable IN (0, 1))
) STRICT;

CREATE TABLE import_items (
  id TEXT PRIMARY KEY NOT NULL,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  candidate_label TEXT NOT NULL,
  original_metadata_json TEXT CHECK (original_metadata_json IS NULL OR CASE WHEN json_valid(original_metadata_json) THEN json_type(original_metadata_json) = 'object' ELSE 0 END),
  source_platform TEXT CHECK (source_platform = 'youtube'),
  capture_id TEXT,
  validation_issues_json TEXT NOT NULL DEFAULT '[]' CHECK (CASE WHEN json_valid(validation_issues_json) THEN json_type(validation_issues_json) = 'array' ELSE 0 END),
  staging_path TEXT,
  final_path TEXT,
  screenshot_id TEXT,
  image_sha256 TEXT CHECK (image_sha256 IS NULL OR (length(image_sha256) = 64 AND image_sha256 NOT GLOB '*[^0-9a-f]*')),
  image_width INTEGER CHECK (image_width > 0 AND image_width <= 9007199254740991),
  image_height INTEGER CHECK (image_height > 0 AND image_height <= 9007199254740991),
  image_byte_size INTEGER CHECK (image_byte_size > 0 AND image_byte_size <= 9007199254740991),
  state TEXT NOT NULL DEFAULT 'awaiting_upload' CHECK (state IN ('awaiting_upload', 'uploading', 'staged', 'validating', 'ready', 'confirmed', 'finalizing', 'finalized', 'committed', 'invalid', 'duplicate', 'skipped', 'conflict', 'failed', 'expired')),
  resume_state TEXT CHECK (resume_state IN ('awaiting_upload', 'uploading', 'staged', 'validating', 'ready', 'confirmed', 'finalizing', 'finalized', 'committed', 'invalid', 'duplicate', 'skipped', 'conflict', 'failed', 'expired')),
  confirmed_decision TEXT CHECK (confirmed_decision IN ('import', 'keepDuplicate', 'skip')),
  confirmation_key TEXT,
  result_kind TEXT CHECK (result_kind IN ('imported', 'duplicate', 'skipped', 'failed')),
  error_code TEXT,
  error_message TEXT,
  retryable INTEGER NOT NULL DEFAULT 0 CHECK (retryable IN (0, 1)),
  result_screenshot_id TEXT REFERENCES screenshots(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (batch_id, ordinal)
) STRICT;
CREATE INDEX import_items_batch_state ON import_items(batch_id, state);
