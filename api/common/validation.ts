const POSITIVE_INT_PATTERN = /^[1-9]\d*$/;

export function parsePositiveInt(value: string | null | undefined): number | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!POSITIVE_INT_PATTERN.test(trimmed)) {
        return null;
    }

    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
}