-- Bootstrap migration: enable extensions required before any table.
-- pgcrypto: gen_random_uuid() for every table's uuid primary key.
-- citext:   case-insensitive email columns (users.email, guest_email, ...).
-- Per app_spec.md § "Data Model & Schema" → "Migration approach".
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
