import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme.js';
import DosePanel from './DosePanel.jsx';

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('DosePanel', () => {
  it('shows a placeholder when no dose data is loaded', () => {
    renderWithTheme(<DosePanel doseData={null} />);
    expect(screen.getByText('No dose loaded')).toBeInTheDocument();
  });

  it('shows dose metadata when available', () => {
    renderWithTheme(
      <DosePanel
        doseData={{
          maxDose: 65.2,
          doseUnits: 'cGy',
          doseType: 'PHYSICAL',
          rows: 100,
          columns: 100,
          numberOfFrames: 5,
        }}
      />
    );
    expect(screen.getByText(/Max: 65\.20 cGy/)).toBeInTheDocument();
    expect(screen.getByText(/Type: PHYSICAL/)).toBeInTheDocument();
    expect(screen.getByText(/Grid: 100 × 100 × 5 frames/)).toBeInTheDocument();
  });

  it('states clearly that overlay rendering is not implemented', () => {
    renderWithTheme(<DosePanel doseData={{ maxDose: 1 }} />);
    expect(screen.getByText(/not implemented yet/i)).toBeInTheDocument();
  });
});
