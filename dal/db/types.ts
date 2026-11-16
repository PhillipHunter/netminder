export type MobilityType = 'neither' | 'mobile' | 'portable';

export interface User {
    id: number;
    username: string;
    full_name: string;
    password_hash: string;
    must_change_password: number;
    is_admin: number;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Net {
    id: number;
    started_at: string | null;
    ended_at: string | null;
    formal_ended_at: string | null;
    topic: string | null;
    created_at: string;
}

export interface Station {
    id: number;
    callsign: string;
    preferred_name: string | null;
    location: string | null;
    notes: string | null;
    qrz_data: string | null;
    qrz_last_fetched_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Checkin {
    id: number;
    net_id: number;
    station_id: number;
    callsign: string;
    display_name: string | null;
    time_entered: string;
    mobility: MobilityType;
    staying: boolean;
    called_back: boolean;
    topic_answer: string | null;
    operator_notes: string | null;
}

export interface Setting {
    key: string;
    value: string;
    created_at: string;
    updated_at: string;
}

export interface UserQRZCredential {
    user_id: number;
    username: string;
    password: string;
    created_at: string;
    updated_at: string;
}