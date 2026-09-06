import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme.js';
import DosePanel from './DosePanel.jsx';

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const DOSE_META = {
  maxDose: 8084.84,
  doseUnits: 'GY',
  doseSummationType: 'PLAN',
  rows: 94,
  columns: 182,
  numberOfFrames: 87,
};

describe('DosePanel', () => {
  it('shows a placeholder when no dose data is loaded', () => {
    renderWithTheme(<DosePanel doseData={null} />);
    expect(screen.getByText('No dose loaded')).toBeInTheDocument();
  });

  it('shows max dose in cGy with the summation type', () => {
    renderWithTheme(
      <DosePanel
        doseData={DOSE_META}
        visible={false}
        opacity={0.5}
        threshold={20}
        onVisibleChange={() => {}}
        onOpacityChange={() => {}}
        onThresholdChange={() => {}}
      />
    );
    expect(screen.getByText(/Max: 8084\.84 cGy/)).toBeInTheDocument();
    expect(screen.getByText(/· PLAN/)).toBeInTheDocument();
  });

  it('toggles visibility through the switch', () => {
    const onVisibleChange = vi.fn();
    renderWithTheme(
      <DosePanel
        doseData={DOSE_META}
        visible={false}
        opacity={0.5}
        threshold={20}
        gridLoading={false}
        onVisibleChange={onVisibleChange}
        onOpacityChange={() => {}}
        onThresholdChange={() => {}}
      />
    );
    const sw = screen.getByRole('checkbox');
    fireEvent.click(sw);
    expect(onVisibleChange).toHaveBeenCalledWith(true);
  });

  it('displays the threshold value in the label', () => {
    renderWithTheme(
      <DosePanel
        doseData={DOSE_META}
        visible
        opacity={0.5}
        threshold={30}
        onVisibleChange={() => {}}
        onOpacityChange={() => {}}
        onThresholdChange={() => {}}
      />
    );
    expect(screen.getByText(/Threshold: 30%/)).toBeInTheDocument();
  });

  describe('isodose levels editor', () => {
    const LEVELS = [
      { id: 1, pct: 95, visible: true, color: '#ff5c5c' },
      { id: 2, pct: 50, visible: true, color: '#9ae66e' },
    ];
    const renderEditor = (onLevelsChange = vi.fn()) => {
      renderWithTheme(
        <DosePanel
          doseData={DOSE_META}
          visible
          opacity={0.5}
          threshold={20}
          isodoseLevels={LEVELS}
          onVisibleChange={() => {}}
          onOpacityChange={() => {}}
          onThresholdChange={() => {}}
          onLevelsChange={onLevelsChange}
        />
      );
      return onLevelsChange;
    };

    it('renders the sorted level list and count', () => {
      renderEditor();
      expect(screen.getByText('ISODOSE LINES (2)')).toBeInTheDocument();
      // sorted descending: 95 first, 50 second
      const value95 = screen.getByLabelText('isodose-value-95');
      expect(value95).toHaveValue('95');
      expect(screen.getByLabelText('isodose-value-50')).toBeInTheDocument();
    });

    it('adds a level with an unused color and new id', () => {
      const onLevelsChange = renderEditor();
      fireEvent.click(screen.getByRole('button', { name: /add level/i }));
      expect(onLevelsChange).toHaveBeenCalledTimes(1);
      const next = onLevelsChange.mock.calls[0][0];
      expect(next).toHaveLength(3);
      expect(next[2].pct).toBe(40);
      expect(next[2].visible).toBe(true);
      // color must not collide with existing levels
      expect(next.map(l => l.color)).toHaveLength(new Set(next.map(l => l.color)).size);
    });

    it('deletes a level by id', () => {
      const onLevelsChange = renderEditor();
      fireEvent.click(screen.getByLabelText('isodose-delete-50'));
      const next = onLevelsChange.mock.calls[0][0];
      expect(next).toHaveLength(1);
      expect(next[0].id).toBe(1);
    });

    it('commits a valid edited pct', () => {
      const onLevelsChange = renderEditor();
      const input = screen.getByLabelText('isodose-value-50');
      fireEvent.change(input, { target: { value: '65' } });
      const next = onLevelsChange.mock.calls[0][0];
      const changed = next.find(l => l.id === 2);
      expect(changed.pct).toBe(65);
    });

    it('ignores invalid pct edits (out of range / non-numeric)', () => {
      const onLevelsChange = renderEditor();
      fireEvent.change(screen.getByLabelText('isodose-value-50'), { target: { value: '150' } });
      fireEvent.change(screen.getByLabelText('isodose-value-50'), { target: { value: 'abc' } });
      expect(onLevelsChange).not.toHaveBeenCalled();
    });

    it('toggles level visibility', () => {
      const onLevelsChange = renderEditor();
      fireEvent.click(screen.getByLabelText('isodose-visible-50'));
      const next = onLevelsChange.mock.calls[0][0];
      expect(next.find(l => l.id === 2).visible).toBe(false);
    });
  });
});
