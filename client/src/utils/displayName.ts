export interface ParsedDisplayName {
    text: string;
    fromQrz: boolean;
}

const QRZ_SUFFIX = ' (qrz)';

export function parseDisplayName(value?: string | null): ParsedDisplayName {
    if (!value) {
        return { text: '', fromQrz: false };
    }

    if (value.toLowerCase().endsWith(QRZ_SUFFIX)) {
        return {
            text: value.slice(0, -QRZ_SUFFIX.length),
            fromQrz: true
        };
    }

    return {
        text: value,
        fromQrz: false
    };
}