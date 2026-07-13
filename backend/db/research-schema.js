// db/research-schema.js

const RESEARCH_SCHEMA = `
CREATE TABLE IF NOT EXISTS hypotheses (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  statement TEXT NOT NULL,
  prediction TEXT NOT NULL,
  kill_criterion TEXT NOT NULL,
  data_range TEXT,
  holdout_range TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  verdict_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  adjudicated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_domain ON hypotheses(domain);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);

CREATE TABLE IF NOT EXISTS hypothesis_results (
  id SERIAL PRIMARY KEY,
  hypothesis_id INTEGER NOT NULL REFERENCES hypotheses(id),
  parameters JSONB,
  metrics JSONB,
  is_holdout BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hyp_results_hyp ON hypothesis_results(hypothesis_id);
`;

module.exports = { RESEARCH_SCHEMA };