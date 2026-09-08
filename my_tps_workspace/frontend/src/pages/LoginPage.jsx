import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Alert, Tabs, Tab,
} from '@mui/material';

/**
 * LoginPage - email/password sign-in with a register tab. After success the
 * JWT cookie is set by the backend and the app re-checks /api/auth/me.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name } : { email, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Authentication failed');
      }
      navigate('/patients');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default',
    }}>
      <Paper sx={{ p: 4, width: 340, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" sx={{ fontFamily: 'mono', letterSpacing: 1 }}>
          TPS — Sign in
        </Typography>
        <Tabs value={mode} onChange={(_, v) => setMode(v)}>
          <Tab value="login" label="Login" />
          <Tab value="register" label="Register" />
        </Tabs>
        {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mode === 'register' && (
            <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required fullWidth />
          )}
          <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required fullWidth />
          <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required fullWidth />
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
