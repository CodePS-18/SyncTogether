import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,setUser] = useState(null);
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('st_token')) return setLoading(false);
    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => localStorage.removeItem('st_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email,password) => {
    const r = await api.post('/auth/login',{email,password});
    localStorage.setItem('st_token',r.data.token);
    setUser(r.data.user);
  };

  const register = async (data) => {
    const r = await api.post('/auth/register',data);
    localStorage.setItem('st_token',r.data.token);
    setUser(r.data.user);
  };

  const googleLogin = async (credential) => {
    const r = await api.post('/auth/google', { credential });
    localStorage.setItem('st_token', r.data.token);
    setUser(r.data.user);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('st_token');
    setUser(null);
  };

  return <AuthContext.Provider value={{user,loading,login,register,googleLogin,logout,setUser}}>
    {children}
  </AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
