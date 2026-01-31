-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  title_en TEXT,
  summary TEXT,
  full_text TEXT,
  bill_number TEXT,
  date DATE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voting_id TEXT NOT NULL,
  bill_id UUID REFERENCES bills(id),
  mp_uuid TEXT NOT NULL,
  mp_name TEXT NOT NULL,
  party TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('FOR', 'AGAINST', 'ABSTAIN', 'ABSENT')),
  voting_title TEXT,
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speeches table
CREATE TABLE IF NOT EXISTS speeches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mp_uuid TEXT NOT NULL,
  session_date DATE NOT NULL,
  session_type TEXT CHECK (session_type IN ('PLENARY', 'COMMITTEE')),
  topic TEXT,
  full_text TEXT NOT NULL,
  related_bill_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings table for vector storage
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type TEXT NOT NULL CHECK (source_type IN ('vote', 'bill', 'speech')),
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_votes_mp_uuid ON votes(mp_uuid);
CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(date);
CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id);
CREATE INDEX IF NOT EXISTS idx_speeches_mp_uuid ON speeches(mp_uuid);
CREATE INDEX IF NOT EXISTS idx_speeches_session_date ON speeches(session_date);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);

-- Create vector index for similarity search
-- Using HNSW for better performance with approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create a view for vote summaries
CREATE OR REPLACE VIEW vote_summary AS
SELECT
  v.id,
  v.voting_id,
  v.mp_uuid,
  v.mp_name,
  v.party,
  v.decision,
  v.voting_title,
  v.date,
  b.title as bill_title,
  b.title_en as bill_title_en,
  b.summary as bill_summary,
  b.category as bill_category
FROM votes v
LEFT JOIN bills b ON v.bill_id = b.id;
