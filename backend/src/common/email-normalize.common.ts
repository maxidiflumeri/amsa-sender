import { createHash } from 'node:crypto';
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function hashEmail(email: string) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}