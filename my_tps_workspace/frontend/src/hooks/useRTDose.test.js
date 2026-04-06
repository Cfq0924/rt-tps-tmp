import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRTDose } from './useRTDose';

// Mock fetch
global.fetch = vi.fn();

describe('useRTDose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useRTDose());

      expect(result.current.doseData).toBe(null);
      expect(result.current.visible).toBe(false);
      expect(result.current.opacity).toBe(0.5);
      expect(result.current.threshold).toBe(50);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('loadDose', () => {
    it('should load dose data from API', async () => {
      const mockResponse = {
        doseGridScaling: 0.0001,
        doseType: 'PHYSICAL',
        doseUnits: 'GY',
        maxDose: 5000,
        gridSize: { rows: 10, columns: 10, frames: 50 },
        imagePosition: { x: 0, y: 0, z: 0 },
        imageOrientation: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
        pixelSpacing: { i: 2, j: 2 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTDose());

      await act(async () => {
        await result.current.loadDose(1);
      });

      expect(result.current.doseData).toMatchObject({
        doseGridScaling: 0.0001,
        doseType: 'PHYSICAL',
        doseUnits: 'GY',
        maxDose: 5000,
      });
      expect(result.current.visible).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      const { result } = renderHook(() => useRTDose());

      await act(async () => {
        await result.current.loadDose(1);
      });

      expect(result.current.error).toBe('Failed to load RT Dose');
      expect(result.current.doseData).toBe(null);
    });

    it('should set error on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRTDose());

      await act(async () => {
        await result.current.loadDose(1);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('setVisible', () => {
    it('should set visibility', () => {
      const { result } = renderHook(() => useRTDose());

      act(() => {
        result.current.setVisible(true);
      });

      expect(result.current.visible).toBe(true);

      act(() => {
        result.current.setVisible(false);
      });

      expect(result.current.visible).toBe(false);
    });
  });

  describe('setOpacity', () => {
    it('should set opacity within bounds', () => {
      const { result } = renderHook(() => useRTDose());

      act(() => {
        result.current.setOpacity(0.7);
      });

      expect(result.current.opacity).toBe(0.7);
    });

    it('should clamp opacity to 0-1 range', () => {
      const { result } = renderHook(() => useRTDose());

      act(() => {
        result.current.setOpacity(1.5);
      });

      expect(result.current.opacity).toBe(1);

      act(() => {
        result.current.setOpacity(-0.5);
      });

      expect(result.current.opacity).toBe(0);
    });
  });

  describe('setThreshold', () => {
    it('should set threshold within bounds', () => {
      const { result } = renderHook(() => useRTDose());

      act(() => {
        result.current.setThreshold(75);
      });

      expect(result.current.threshold).toBe(75);
    });

    it('should clamp threshold to 0-100 range', () => {
      const { result } = renderHook(() => useRTDose());

      act(() => {
        result.current.setThreshold(150);
      });

      expect(result.current.threshold).toBe(100);

      act(() => {
        result.current.setThreshold(-10);
      });

      expect(result.current.threshold).toBe(0);
    });
  });
});
