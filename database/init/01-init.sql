-- Database initialization script for Docker
-- This script runs when the PostgreSQL container starts for the first time

-- Create the database if it doesn't exist
SELECT 'CREATE DATABASE globalland_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'globalland_dev')\gexec

-- Create test database
SELECT 'CREATE DATABASE globalland_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'globalland_test')\gexec

-- Connect to the main database
\c globalland_dev;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a basic health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW();
END;
$$ LANGUAGE plpgsql;