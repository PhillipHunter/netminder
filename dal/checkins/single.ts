import { db } from '../db';

export interface RawCheckinRow {
    id: number;
    net_id: number;
    station_id: number;
    callsign: string;
    display_name: string | null;
    time_entered: string;
    mobility: string;
    staying: number;
    called_back: number;
    topic_answer: string | null;
    operator_notes: string | null;
}

export function getCheckinById(id: number): RawCheckinRow | null {
    const row = db.prepare<RawCheckinRow>('SELECT * FROM checkins WHERE id = ?').get(id);
    return row ?? null;
}