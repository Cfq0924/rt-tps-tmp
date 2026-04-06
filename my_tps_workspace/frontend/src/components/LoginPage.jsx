import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Alert, CircularProgress,
} from '@mui/material';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister ? form : { email: form.email, password: form.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      navigate('/patients');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, #0d2540 0%, #07111f 70%)',
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          background: 'rgba(13,31,51,0.95)',
          border: '1px solid rgba(88,196,220,0.2)',
        }}
      >
        <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600, color: 'primary.main' }}>
          TPS
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          Treatment Planning System
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isRegister && (
            <TextField
              label="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              size="small"
              autoComplete="name"
            />
          )}
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            size="small"
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            size="small"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          <Button type="submit" variant="contained" disabled={loading} sx={{ mt: 1 }}>
            {loading ? <CircularProgress size={20} /> : isRegister ? 'Create Account' : 'Sign In'}
          </Button>
        </Box>

        <Button
          sx={{ mt: 2, textTransform: 'none', fontSize: '0.8125rem' }}
          onClick={() => { setIsRegister(r => !r); setError(''); }}
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </Button>
      </Paper>
    </Box>
  );
}
