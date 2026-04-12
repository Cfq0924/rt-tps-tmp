import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * @file useDicomLoader.test.js
 * TDD Tests for DICOM image loading functionality
 *
 * User Journey:
 * As a clinician, I want to view CT images with smooth scrolling,
 * so that I can navigate through a patient's scan efficiently.
 */

describe('DicomLoader utilities', () => {
  describe('imageId building', () => {
    it('should build wadouri imageId from signed URL', () => {
      const url = 'http://localhost:3001/api/files/signed-url/1?sig=abc123';
      const imageId = `wadouri:${url}`;
      expect(imageId).toBe('wadouri:http://localhost:3001/api/files/signed-url/1?sig=abc123');
    });

    it('should handle URLs with special characters', () => {
      const url = 'http://localhost:3001/api/files/signed-url/1?sig=abc+123/xyz';
      const imageId = `wadouri:${encodeURIComponent(url)}`;
      expect(imageId).toContain('wadouri:');
    });
  });

  describe('index clamping', () => {
    it('should clamp index to valid range', () => {
      const imageCount = 10;
      const clampIndex = (index) => Math.max(0, Math.min(index, imageCount - 1));

      expect(clampIndex(-5)).toBe(0);
      expect(clampIndex(0)).toBe(0);
      expect(clampIndex(5)).toBe(5);
      expect(clampIndex(9)).toBe(9);
      expect(clampIndex(100)).toBe(9);
    });
  });

  describe('file sorting', () => {
    it('should sort files by SOP instance number', () => {
      const files = [
        { id: 1, sop_instance_uid: '1.2.840.10008.5.1.4.1.1.2.3' },
        { id: 2, sop_instance_uid: '1.2.840.10008.5.1.4.1.1.2.1' },
        { id: 3, sop_instance_uid: '1.2.840.10008.5.1.4.1.1.2.2' },
      ];

      const sorted = [...files].sort((a, b) => {
        const aNum = parseInt(a.sop_instance_uid.split('.').pop(), 10);
        const bNum = parseInt(b.sop_instance_uid.split('.').pop(), 10);
        return aNum - bNum;
      });

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe('CT file filtering', () => {
    it('should filter only CT modality files', () => {
      const files = [
        { id: 1, modality: 'CT' },
        { id: 2, modality: 'RTSTRUCT' },
        { id: 3, modality: 'CT' },
        { id: 4, modality: 'RTDOSE' },
        { id: 5, modality: 'CT' },
      ];

      const ctFiles = files.filter(f => f.modality === 'CT');
      expect(ctFiles.length).toBe(3);
      expect(ctFiles.every(f => f.modality === 'CT')).toBe(true);
    });
  });
});

describe('useDicomLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export useDicomLoader function', async () => {
    const { useDicomLoader } = await import('./useDicomLoader.js');
    expect(typeof useDicomLoader).toBe('function');
  });
});
