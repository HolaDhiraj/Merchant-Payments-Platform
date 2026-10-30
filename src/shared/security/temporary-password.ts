import { randomInt } from 'crypto';

// Letters and digits that cannot be confused when read aloud or copied by hand (no 0/O, 1/l/I).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const LENGTH = 14;

// One-time password handed to a new merchant owner. It satisfies the password policy
// (12+ characters with letters and digits) and must be changed at the first sign-in.
export function generateTemporaryPassword(): string {
  const alphabet = LETTERS + DIGITS;
  const chars = Array.from({ length: LENGTH - 2 }, () => alphabet[randomInt(alphabet.length)]);
  chars.push(LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]);
  // Fisher-Yates shuffle so the guaranteed letter and digit are not always last.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
