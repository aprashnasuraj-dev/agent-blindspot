import { getSession } from './auth/session.js';

export function login(userId: string): string {
  return getSession(userId).redirect;
}
