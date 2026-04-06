import { createTheme } from '@mui/material/styles';

// Clinical Precision — dark clinical theme per DESIGN.md
// Teal primary #58c4dc, Amber dose #f6c177, Dark navy base #07111f
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#58c4dc',
      light: '#8ed8e8',
      dark: '#2a9db8',
      contrastText: '#07111f',
    },
    secondary: {
      main: '#f6c177',
      light: '#f9d49b',
      dark: '#c9963a',
      contrastText: '#07111f',
    },
    background: {
      default: '#07111f',
      paper: '#0d1f33',
    },
    text: {
      primary: '#e8edf3',
      secondary: '#8ba3b9',
    },
    error: { main: '#e05a5a' },
    warning: { main: '#f6c177' },
    success: { main: '#5aae7a' },
    info: { main: '#58c4dc' },
    divider: 'rgba(88,196,220,0.12)',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", sans-serif',
    mono: '"IBM Plex Mono", monospace',
    h1: { fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#2a9db8 #0d1f33',
          '&::-webkit-scrollbar': { width: 8, height: 8 },
          '&::-webkit-scrollbar-thumb': { background: '#2a9db8', borderRadius: 4 },
          '&::-webkit-scrollbar-track': { background: '#0d1f33' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(88,196,220,0.12)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: '#1a3050',
          border: '1px solid rgba(88,196,220,0.2)',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.75rem' },
      },
    },
  },
});

export default theme;
