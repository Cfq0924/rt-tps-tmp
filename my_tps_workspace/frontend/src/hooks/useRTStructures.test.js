import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRTStructures } from './useRTStructures';

// Mock fetch
global.fetch = vi.fn();

describe('useRTStructures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useRTStructures());

      expect(result.current.structures).toEqual([]);
      expect(result.current.contours).toEqual([]);
      expect(result.current.selectedStructureId).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('loadStructures', () => {
    it('should load structures from API', async () => {
      const mockResponse = {
        roiSequence: [
          { roiNumber: 1, roiName: 'PTV', displayColor: { r: 255, g: 0, b: 0 } },
          { roiNumber: 2, roiName: 'GTV', displayColor: { r: 0, g: 255, b: 0 } },
        ],
        contourSequence: [
          {
            referencedSOPInstanceUID: '1.2.3.4',
            referencedROINumber: 1,
            contourData: [1, 2, 3, 4, 5, 6],
            displayColor: { r: 255, g: 0, b: 0 },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      expect(result.current.structures).toHaveLength(2);
      expect(result.current.structures[0]).toMatchObject({
        roiNumber: 1,
        roiName: 'PTV',
        visible: true,
      });
      expect(result.current.contours).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      expect(result.current.error).toBe('Failed to load RT Structure');
      expect(result.current.structures).toEqual([]);
    });

    it('should set error on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('toggleStructureVisibility', () => {
    it('should toggle structure visibility', async () => {
      const mockResponse = {
        roiSequence: [
          { roiNumber: 1, roiName: 'PTV', displayColor: { r: 255, g: 0, b: 0 } },
        ],
        contourSequence: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      expect(result.current.structures[0].visible).toBe(true);

      act(() => {
        result.current.toggleStructureVisibility(1);
      });

      expect(result.current.structures[0].visible).toBe(false);
    });
  });

  describe('selectStructure', () => {
    it('should select a structure', () => {
      const { result } = renderHook(() => useRTStructures());

      act(() => {
        result.current.selectStructure(1);
      });

      expect(result.current.selectedStructureId).toBe(1);
    });

    it('should deselect when null is passed', () => {
      const { result } = renderHook(() => useRTStructures());

      act(() => {
        result.current.selectStructure(1);
      });

      act(() => {
        result.current.selectStructure(null);
      });

      expect(result.current.selectedStructureId).toBe(null);
    });
  });

  describe('getContoursForSlice', () => {
    it('should return contours for a slice', async () => {
      const mockResponse = {
        roiSequence: [
          { roiNumber: 1, roiName: 'PTV', displayColor: { r: 255, g: 0, b: 0 } },
        ],
        contourSequence: [
          {
            referencedSOPInstanceUID: '1.2.3.4',
            referencedROINumber: 1,
            contourData: [1, 2, 3],
            displayColor: { r: 255, g: 0, b: 0 },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      const contours = result.current.getContoursForSlice('1.2.3.4');

      expect(contours).toHaveLength(1);
      expect(contours[0].referencedSOPInstanceUID).toBe('1.2.3.4');
    });

    it('should return empty array for non-existent slice', async () => {
      const mockResponse = {
        roiSequence: [
          { roiNumber: 1, roiName: 'PTV', displayColor: { r: 255, g: 0, b: 0 } },
        ],
        contourSequence: [
          {
            referencedSOPInstanceUID: '1.2.3.4',
            referencedROINumber: 1,
            contourData: [1, 2, 3],
            displayColor: { r: 255, g: 0, b: 0 },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      const contours = result.current.getContoursForSlice('non.existent');

      expect(contours).toHaveLength(0);
    });

    it('should not return contours for invisible structures', async () => {
      const mockResponse = {
        roiSequence: [
          { roiNumber: 1, roiName: 'PTV', displayColor: { r: 255, g: 0, b: 0 } },
        ],
        contourSequence: [
          {
            referencedSOPInstanceUID: '1.2.3.4',
            referencedROINumber: 1,
            contourData: [1, 2, 3],
            displayColor: { r: 255, g: 0, b: 0 },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRTStructures());

      await act(async () => {
        await result.current.loadStructures(1);
      });

      // Toggle visibility off
      act(() => {
        result.current.toggleStructureVisibility(1);
      });

      const contours = result.current.getContoursForSlice('1.2.3.4');

      expect(contours).toHaveLength(0);
    });
  });
});
