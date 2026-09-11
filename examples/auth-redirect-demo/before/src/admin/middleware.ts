import { getSession } from '../auth/session.js';

export function requireAdmin(userId: string): boolean {
  return getSession(userId).role === 'admin';
}
