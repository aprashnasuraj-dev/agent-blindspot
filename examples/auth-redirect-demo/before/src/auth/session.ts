export interface Session {
  userId: string;
  role: 'user' | 'admin';
}

export function getSession(userId: string): Session {
  return { userId, role: userId === 'admin' ? 'admin' : 'user' };
}
