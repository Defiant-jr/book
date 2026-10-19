import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(undefined);

async function authRequest(path, body) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Sessao encerrada. Entre novamente.');
  return data;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    // Discard the previous browser-only login bypass.
    localStorage.removeItem('book_local_auth');
    authRequest('session')
      .then(data => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const signIn = useCallback(async (usuario, senha) => {
    try {
      const data = await authRequest('login', { usuario, senha });
      setUser(data.user);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, []);
  const signOut = useCallback(async () => {
    try {
      await authRequest('logout', {});
      setUser(null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, []);
  const value = useMemo(() => ({ user, session: user ? { user } : null, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
