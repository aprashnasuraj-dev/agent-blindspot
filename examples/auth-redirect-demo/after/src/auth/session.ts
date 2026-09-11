export interface Session {
  userId: string;
  role: 'user' | 'admin';
  redirect: string;
}

export function getSession(userId: string): Session {
  const role = userId === 'admin' ? 'admin' : 'user';
  return { userId, role, redirect: role === 'admin' ? '/admin' : '/home' };
}
