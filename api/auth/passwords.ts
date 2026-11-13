import {
    compare,
    hash
} from 'bcryptjs';

const DEFAULT_SALT_ROUNDS = 12;

export function hashPassword(password: string, saltRounds = DEFAULT_SALT_ROUNDS): Promise<string> {
    return new Promise((resolve, reject) => {
        hash(password, saltRounds, (error, result) => {
            if (error || typeof result !== 'string') {
                reject(error ?? new Error('Failed to hash password'));
                return;
            }
            resolve(result);
        });
    });
}

export function comparePassword(candidate: string, hashValue: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        compare(candidate, hashValue, (error, same) => {
            if (error || typeof same !== 'boolean') {
                reject(error ?? new Error('Failed to compare password'));
                return;
            }
            resolve(same);
        });
    });
}