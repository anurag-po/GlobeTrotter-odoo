-- Migration 0002: Enums
-- Defines closed PostgreSQL native enum types

CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
CREATE TYPE user_status_enum AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE trip_status_enum AS ENUM ('draft', 'planned', 'ongoing', 'completed', 'cancelled');
CREATE TYPE cost_category_enum AS ENUM ('transport', 'stay', 'activity', 'meal', 'other');
