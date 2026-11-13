import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes
} from 'node:crypto';

export class EncryptionError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'EncryptionError';
    }
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const DEV_FALLBACK_KEY = 'development-config-encryption-key-change-me';

function resolveEncryptionKey(): Buffer {
    const keyMaterial = process.env.CONFIG_ENCRYPTION_KEY?.trim();

    if (!keyMaterial || keyMaterial.length === 0) {
        if (process.env.NODE_ENV === 'production') {
            throw new EncryptionError(
                'CONFIG_ENCRYPTION_KEY_REQUIRED',
                'CONFIG_ENCRYPTION_KEY environment variable must be set for secret storage.'
            );
        }

        return createHash('sha256').update(DEV_FALLBACK_KEY).digest();
    }

    return createHash('sha256').update(keyMaterial).digest();
}

export function encryptSecret(plainText: string): string {
    try {
        const key = resolveEncryptionKey();
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, key, iv);

        const encrypted = Buffer.concat([
            cipher.update(plainText, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        return [
            iv.toString('base64'),
            authTag.toString('base64'),
            encrypted.toString('base64')
        ].join(':');
    } catch (error) {
        if (error instanceof EncryptionError) {
            throw error;
        }

        throw new EncryptionError(
            'ENCRYPTION_FAILED',
            'Failed to encrypt secret value.'
        );
    }
}

export function decryptSecret(serialized: string): string {
    const segments = serialized.split(':');

    if (segments.length !== 3) {
        throw new EncryptionError(
            'INVALID_PAYLOAD_FORMAT',
            'Encrypted value payload format is invalid.'
        );
    }

    const [ivB64, authTagB64, ciphertextB64] = segments;

    try {
        const key = resolveEncryptionKey();
        const decipher = createDecipheriv(
            ALGORITHM,
            key,
            Buffer.from(ivB64, 'base64')
        );

        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(ciphertextB64, 'base64')),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        if (error instanceof EncryptionError) {
            throw error;
        }

        throw new EncryptionError(
            'DECRYPTION_FAILED',
            'Failed to decrypt secret value.'
        );
    }
}