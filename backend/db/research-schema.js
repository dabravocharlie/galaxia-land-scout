// db/research-schema.js
// Research engine tables, kept in their own file so the main schema string in
// init.js stays untouched. Exported as a SQL string and run by init.js right
// after the main schema. Idempotent — safe to run repeatedly.

const { RESEARCH_SCHEMA } = require('./research-schema');`
-- ============================================================
-- RESEARCH ENGINE
-- Every idea gets registered with a prediction and a kill-criterion BEFORE
-- it's tested. Results are appended, never edited. Append-only by design:
-- no tool edits a prediction or kill_criterion after the fact. The friction
-- is the point — it makes quietly rewriting history harder.
-- ============================================================

CREATE TABLE IF NOT EXISTS hypotheses (
  id SERIAL PRIMARY KEY,

  domain TEXT NOT NULL,              -- 'markets' | 'land' | 'business' | 'other'
  statement TEXT NOT NULL,           -- the claim being tested, in plain words

  -- WRITE-ONCE. Recorded before any result is seen.
  prediction TEXT NOT NULL,          -- what you expect, specifically
  kill_criterion TEXT NOT NULL,      -- the result that would falsify it

  data_range TEXT,                   -- in-sample data used
  holdout_range TEXT,                -- the sealed out-of-sample set

  status TEXT NOT NULL DEFAULT 'open',  -- 'open'|'confirmed'|'falsified'|'abandoned'
  verdict_notes TEXT,                -- filled only when status leaves 'open'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  adjudicated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_domain ON hypotheses(domain);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);

CREATE TABLE IF NOT EXISTS hypothesis_results (
  id SERIAL PRIMARY KEY,
  hypothesis_id INTEGER NOT NULL REFERENCES hypotheses(id),

  parameters JSONB,                  -- {"ConfirmBars": 3}
  metrics JSONB,                     -- {"pf": 1.05, "trades": 1630, "max_dd": 12904}
  is_holdout BOOLEAN NOT NULL DEFAULT FALSE,  -- true = run against the SEALED set
  notes TEXT,

  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hyp_results_hyp ON hypothesis_results(hypothesis_id);
`;

module.exports = { RESEARCH_SCHEMA };