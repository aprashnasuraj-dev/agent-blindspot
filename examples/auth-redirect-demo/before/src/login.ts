import { getSession } from './auth/session.js';

export function login(userId: string): string {
  const session = getSession(userId);
  return `/home/${session.userId}`;
}
