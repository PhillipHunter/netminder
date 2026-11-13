import { randomBytes } from 'node:crypto';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@$';
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;
const PASSWORD_LENGTH = 8;
const MAX_SYMBOLS = 2;
const REQUIRED_CATEGORIES = 3; // uppercase, lowercase, symbol

function randomChar(source: string): string {
    const byte = randomBytes(1)[0];
    return source[byte % source.length];
}

function shuffle(chars: string[]): void {
    for (let index = chars.length - 1; index > 0; index -= 1) {
        const byte = randomBytes(1)[0];
        const swapIndex = byte % (index + 1);
        const temp = chars[index];
        chars[index] = chars[swapIndex];
        chars[swapIndex] = temp;
    }
}

export function generateTemporaryPassword(length = PASSWORD_LENGTH): string {
    if (length < REQUIRED_CATEGORIES) {
        throw new Error('Password length must be at least 3 to satisfy complexity requirements');
    }

    const characters: string[] = [
        randomChar(UPPERCASE),
        randomChar(LOWERCASE),
        randomChar(SYMBOLS)
    ];
    let symbolCount = 1;

    // Limit temporary passwords to at most two symbols (!, @, $) to keep them easy to dictate over the air.
    while (characters.length < length) {
        const candidate = randomChar(ALL_CHARACTERS);
        const isSymbol = SYMBOLS.includes(candidate);

        if (isSymbol && symbolCount >= MAX_SYMBOLS) {
            continue;
        }

        characters.push(candidate);
        if (isSymbol) {
            symbolCount += 1;
        }
    }

    shuffle(characters);
    return characters.join('');
}