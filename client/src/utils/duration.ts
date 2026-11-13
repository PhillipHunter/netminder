export function getDurationMinutes(start: string, end: string): number | null {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return null;
    }

    const diffMs = endMs - startMs;
    if (diffMs < 0) {
        return null;
    }

    return Math.max(0, Math.floor(diffMs / 60000));
}

export function formatDurationLabel(totalMinutes: number): string {
    if (totalMinutes <= 0) {
        return '0m';
    }

    const wholeMinutes = Math.floor(totalMinutes);
    const days = Math.floor(wholeMinutes / 1440);
    const remainderAfterDays = wholeMinutes % 1440;
    const hours = Math.floor(remainderAfterDays / 60);
    const minutes = remainderAfterDays % 60;

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }

    if (hours > 0) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0 || parts.length === 0) {
        parts.push(`${minutes}m`);
    }

    return parts.join(' ');
}