export function normalizeErrorMessage(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === '[object Object]') {
        return null;
    }

    return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

const NESTED_KEYS = ['message', 'error', 'detail', 'reason', 'data', 'code'] as const;
type NestedErrorFields = Partial<Record<typeof NESTED_KEYS[number], unknown>>;

export function resolveErrorMessage(error: unknown, fallback: string): string {
    const direct = normalizeErrorMessage(error);
    if (direct) {
        return direct;
    }

    const queue: unknown[] = [];
    const seen = new Set<object>();

    if (error !== undefined) {
        queue.push(error);
    }

    let fallbackCode: string | null = null;

    while (queue.length > 0) {
        const current = queue.shift();

        if (current === null || current === undefined) {
            continue;
        }

        if (typeof current === 'object' || typeof current === 'function') {
            const ref = current;
            if (seen.has(ref)) {
                continue;
            }
            seen.add(ref);
        }

        const normalized = normalizeErrorMessage(current);
        if (normalized) {
            return normalized;
        }

        if (current instanceof Error) {
            const message = normalizeErrorMessage(current.message);
            if (message) {
                return message;
            }

            const errorLike = current as NestedErrorFields;

            for (const key of NESTED_KEYS) {
                const value: unknown = errorLike[key];
                if (value === undefined) {
                    continue;
                }

                if (key === 'code' && fallbackCode === null) {
                    const codeCandidate = normalizeErrorMessage(value);
                    if (codeCandidate) {
                        fallbackCode = codeCandidate;
                    }
                }

                queue.push(value);
            }

            const errorObject = current as unknown as Record<string, unknown>;
            for (const value of Object.values(errorObject)) {
                queue.push(value);
            }

            continue;
        }

        if (Array.isArray(current)) {
            for (const value of current) {
                queue.push(value);
            }
            continue;
        }

        if (current instanceof Response) {
            continue;
        }

        if (!isRecord(current)) {
            continue;
        }

        const record = current;

        for (const key of NESTED_KEYS) {
            if (!(key in record)) {
                continue;
            }

            const value: unknown = record[key];

            if (key === 'code' && fallbackCode === null) {
                const codeCandidate = normalizeErrorMessage(value);
                if (codeCandidate) {
                    fallbackCode = codeCandidate;
                }
            }

            queue.push(value);
        }

        for (const value of Object.values(record)) {
            queue.push(value);
        }
    }

    if (fallbackCode) {
        return fallbackCode;
    }

    return fallback;
}