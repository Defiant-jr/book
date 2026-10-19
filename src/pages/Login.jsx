import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const Login = () => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(usuario.trim(), password);
      if (error) {
        toast({ variant: 'destructive', title: 'Falha no Login', description: error.message });
        return;
      }
      navigate('/', { replace: true });
    } catch {
      toast({ variant: 'destructive', title: 'Falha no Login', description: 'Nao foi possivel conectar ao servidor.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 space-y-8 glass-card"
      >
        <div className="text-center">
          <div className="flex justify-center">
            <img
              src="/brand/book-plus-logo.png"
              alt="BooK+"
              className="w-60 max-w-full opacity-85 mix-blend-screen select-none pointer-events-none"
            />
          </div>
          <h1 className="text-4xl font-bold gradient-text">BooK+</h1>
          <p className="text-muted-foreground">Bem-vindo de volta! Faca login para continuar.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              type="text"
              placeholder="Seu usuario"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              className="bg-slate-800/50 border-slate-700"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-800/50 border-slate-700"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
