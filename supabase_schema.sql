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
