-- Migration 0001: Extensions
-- Enables pgcrypto for cryptographic hashing and gen_random_uuid()
-- Enables citext for case-insensitive username and email uniqueness

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
