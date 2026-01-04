-- schema.sql
-- Notes Service Database Schema

-- Main notes table
CREATE TABLE IF NOT EXISTS notes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    content         TEXT NOT NULL,
    source          TEXT DEFAULT 'api',
    created_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    memory_status   TEXT DEFAULT 'pending',
    memory_error    TEXT
);

-- Index for listing notes by user (most common query)
CREATE INDEX IF NOT EXISTS idx_notes_user_created 
ON notes(user_id, created_at DESC);

-- Index for finding pending memory jobs
CREATE INDEX IF NOT EXISTS idx_notes_memory_pending 
ON notes(memory_status) 
WHERE memory_status = 'pending';

-- Index for finding failed memory jobs (for retry/debugging)
CREATE INDEX IF NOT EXISTS idx_notes_memory_failed 
ON notes(memory_status) 
WHERE memory_status = 'failed';
