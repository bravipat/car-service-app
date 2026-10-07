-- Tables added for saved vehicles and NHTSA manufacturer communications.
-- The app also creates these automatically on first use (src/lib/schema.ts),
-- so running this file by hand is optional.

CREATE TABLE IF NOT EXISTS vehicle_searches (
  id                BIGSERIAL PRIMARY KEY,
  client_id         UUID NOT NULL,          -- anonymous per-browser id, no accounts
  make_id           INTEGER NOT NULL,
  model_id          INTEGER NOT NULL,
  make_name         TEXT NOT NULL,
  model_name        TEXT NOT NULL,
  model_year        INTEGER NOT NULL,
  mileage           INTEGER NOT NULL,
  zip               CHAR(5) NOT NULL,
  last_service_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_searches_client_idx
  ON vehicle_searches (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nhtsa_mfr_comms (
  id            BIGSERIAL PRIMARY KEY,
  bulletin_no   TEXT NOT NULL,
  make          TEXT NOT NULL,
  model         TEXT NOT NULL,
  model_year    INTEGER NOT NULL,
  component     TEXT,
  summary       TEXT,
  bulletin_date DATE,
  UNIQUE (bulletin_no, make, model, model_year)
);
CREATE INDEX IF NOT EXISTS nhtsa_mfr_comms_vehicle_idx
  ON nhtsa_mfr_comms (UPPER(make), UPPER(model), model_year);

-- Reference documents for the "Ask me a question" box, split into chunks by
-- scripts/build-knowledge.py and loaded by scripts/load-knowledge.mjs.
CREATE TABLE IF NOT EXISTS kb_chunks (
  id           BIGSERIAL PRIMARY KEY,
  doc_id       TEXT NOT NULL,
  doc_title    TEXT NOT NULL,
  source_url   TEXT,
  section_path TEXT NOT NULL,
  page_start   INTEGER,
  page_end     INTEGER,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', section_path || ' ' || content)) STORED,
  UNIQUE (doc_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx ON kb_chunks USING GIN (tsv);
