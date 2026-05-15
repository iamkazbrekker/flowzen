-- Run this SQL in your Supabase SQL Editor to create the `disruptions` table

CREATE TABLE disruptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_disruption BOOLEAN,
    event_type TEXT,
    severity TEXT,
    title TEXT,
    summary TEXT,
    location TEXT,
    affected_transport_modes TEXT[],
    affected_trade_routes TEXT[],
    estimated_delay_days NUMERIC,
    economic_impact_level TEXT,
    confidence_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Cost Analysis Request Table ──────────────────────────────────────────────

CREATE TABLE cost_analysis_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL,
    destination TEXT NOT NULL,
    cargo_weight_kg NUMERIC NOT NULL,
    cargo_type TEXT NOT NULL,
    priority TEXT DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Cost Analysis Results Table ──────────────────────────────────────────────

CREATE TABLE cost_analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES cost_analysis_requests(id),
    recommended_mode TEXT,
    estimated_cost_usd NUMERIC,
    estimated_delay_days NUMERIC,
    risk_level TEXT,
    reason TEXT,
    best_route TEXT,
    safest_route TEXT,
    fastest_route TEXT,
    cheapest_route TEXT,
    confidence NUMERIC,
    mode_estimates JSONB,
    disruption_impacts JSONB,
    pipeline_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
