// src/types/index.ts

export interface Disruption {
    id?: string;
    event_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    location: string;
    affected_modes: string[];
    estimated_delay_days: number;
}

export interface Shipment {
    id: string;
    origin: string;
    destination: string;
    mode: string;
    eta?: string;
    status?: string;
}