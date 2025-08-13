-- GlobalLand RWA Platform Database Schema
-- PostgreSQL Database Schema for Real Estate Tokenization Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_kyc_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'expired');
CREATE TYPE user_verification_level AS ENUM ('basic', 'intermediate', 'advanced');
CREATE TYPE property_status AS ENUM ('draft', 'pending_verification', 'tokenizing', 'active', 'sold_out', 'inactive');
CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'industrial', 'land', 'mixed_use');
CREATE TYPE transaction_type AS ENUM ('investment', 'dividend', 'withdrawal', 'transfer', 'fee');
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE investment_status AS ENUM ('active', 'sold', 'partial_sold');
CREATE TYPE order_type AS ENUM ('buy', 'sell');
CREATE TYPE order_status AS ENUM ('open', 'partial_filled', 'filled', 'cancelled');
CREATE TYPE payment_method AS ENUM ('card', 'bank_transfer', 'mobile_money', 'crypto', 'hbar');
CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'HBAR');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    nationality VARCHAR(3), -- ISO 3166-1 alpha-3 country code
    wallet_address VARCHAR(100) UNIQUE,
    kyc_status user_kyc_status DEFAULT 'pending',
    verification_level user_verification_level DEFAULT 'basic',
    kyc_provider VARCHAR(50),
    kyc_reference VARCHAR(100),
    kyc_completed_at TIMESTAMP,
    is_accredited_investor BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id VARCHAR(50) UNIQUE, -- Hedera Token ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    property_type property_type NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    country VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_valuation DECIMAL(15, 2) NOT NULL,
    total_tokens BIGINT NOT NULL,
    available_tokens BIGINT NOT NULL,
    price_per_token DECIMAL(10, 2) NOT NULL,
    minimum_investment DECIMAL(10, 2) DEFAULT 10.00,
    expected_annual_yield DECIMAL(5, 2), -- Percentage
    property_size DECIMAL(10, 2), -- Square meters
    year_built INTEGER,
    property_manager_id UUID REFERENCES users(id),
    management_fee_percentage DECIMAL(5, 2) DEFAULT 1.00,
    platform_fee_percentage DECIMAL(5, 2) DEFAULT 2.50,
    status property_status DEFAULT 'draft',
    listing_date TIMESTAMP,
    tokenization_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property documents table
CREATE TABLE property_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'deed', 'valuation', 'inspection', 'legal', 'financial'
    document_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL, -- IPFS hash or URL
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Investments table
CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    token_amount BIGINT NOT NULL,
    purchase_price_per_token DECIMAL(10, 2) NOT NULL,
    total_purchase_price DECIMAL(15, 2) NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_value DECIMAL(15, 2),
    total_dividends_received DECIMAL(15, 2) DEFAULT 0.00,
    status investment_status DEFAULT 'active',
    blockchain_tx_id VARCHAR(100), -- Hedera transaction ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, property_id) -- One investment record per user per property
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    property_id UUID REFERENCES properties(id),
    investment_id UUID REFERENCES investments(id),
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency currency_code DEFAULT 'USD',
    fee_amount DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) NOT NULL,
    status transaction_status DEFAULT 'pending',
    payment_method payment_method,
    payment_reference VARCHAR(100),
    blockchain_tx_id VARCHAR(100), -- Hedera transaction ID
    description TEXT,
    metadata JSONB, -- Additional transaction data
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dividend distributions table
CREATE TABLE dividend_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    distribution_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    currency currency_code DEFAULT 'USD',
    amount_per_token DECIMAL(10, 6) NOT NULL,
    total_tokens_eligible BIGINT NOT NULL,
    management_fee DECIMAL(15, 2) DEFAULT 0.00,
    platform_fee DECIMAL(15, 2) DEFAULT 0.00,
    net_distribution DECIMAL(15, 2) NOT NULL,
    blockchain_tx_id VARCHAR(100), -- Hedera transaction ID for distribution
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual dividend payments table
CREATE TABLE dividend_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distribution_id UUID NOT NULL REFERENCES dividend_distributions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    investment_id UUID NOT NULL REFERENCES investments(id),
    token_amount BIGINT NOT NULL,
    dividend_amount DECIMAL(15, 2) NOT NULL,
    currency currency_code DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    blockchain_tx_id VARCHAR(100), -- Individual payment transaction ID
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Secondary market orders table
CREATE TABLE market_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    order_type order_type NOT NULL,
    token_amount BIGINT NOT NULL,
    price_per_token DECIMAL(10, 2) NOT NULL,
    total_value DECIMAL(15, 2) NOT NULL,
    filled_amount BIGINT DEFAULT 0,
    remaining_amount BIGINT NOT NULL,
    status order_status DEFAULT 'open',
    expires_at TIMESTAMP,
    filled_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market trades table
CREATE TABLE market_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buy_order_id UUID NOT NULL REFERENCES market_orders(id),
    sell_order_id UUID NOT NULL REFERENCES market_orders(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    token_amount BIGINT NOT NULL,
    price_per_token DECIMAL(10, 2) NOT NULL,
    total_value DECIMAL(15, 2) NOT NULL,
    platform_fee DECIMAL(15, 2) DEFAULT 0.00,
    blockchain_tx_id VARCHAR(100), -- Hedera transaction ID
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'dividend', 'investment', 'kyc', 'security', 'marketing'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional notification data
    read_at TIMESTAMP,
    sent_via VARCHAR(20)[], -- Array of channels: 'email', 'push', 'sms'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

CREATE INDEX idx_properties_token_id ON properties(token_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_country ON properties(country);
CREATE INDEX idx_properties_property_type ON properties(property_type);

CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_property_id ON investments(property_id);
CREATE INDEX idx_investments_status ON investments(status);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_property_id ON transactions(property_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_dividend_distributions_property_id ON dividend_distributions(property_id);
CREATE INDEX idx_dividend_distributions_date ON dividend_distributions(distribution_date);

CREATE INDEX idx_dividend_payments_distribution_id ON dividend_payments(distribution_id);
CREATE INDEX idx_dividend_payments_user_id ON dividend_payments(user_id);

CREATE INDEX idx_market_orders_user_id ON market_orders(user_id);
CREATE INDEX idx_market_orders_property_id ON market_orders(property_id);
CREATE INDEX idx_market_orders_status ON market_orders(status);
CREATE INDEX idx_market_orders_type ON market_orders(order_type);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dividend_distributions_updated_at BEFORE UPDATE ON dividend_distributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_orders_updated_at BEFORE UPDATE ON market_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();