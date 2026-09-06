import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Locate the local test data directory relative to this file. The DICOM test
// data is not committed (see .gitignore) — tests skip when it is missing.
const TEST_DATA_DIR = join(fileURLToPath(import.meta.url), '../../../../test_data/patient1');

function findTestFile(prefix) {
  if (!existsSync(TEST_DATA_DIR)) return null;
  const fileName = readdirSync(TEST_DATA_DIR).find(f => f.startsWith(prefix));
  return fileName ? join(TEST_DATA_DIR, fileName) : null;
}

const TEST_RTSTRUCT_PATH = findTestFile('RS.');
const SKIP_REASON = TEST_RTSTRUCT_PATH ? false : 'test_data/patient1 RTSTRUCT file not available';

describe('rtStructService', { skip: SKIP_REASON }, () => {
  describe('parseRTStruct', () => {
    it('should parse RTSTRUCT file and return ROI sequence', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      assert.ok(result, 'Result should exist');
      assert.ok(result.roiSequence, 'ROI sequence should exist');
      assert.ok(Array.isArray(result.roiSequence), 'ROI sequence should be an array');
      assert.ok(result.roiSequence.length > 0, 'ROI sequence should have at least one ROI');
    });

    it('should extract ROI number and name for each structure', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      for (const roi of result.roiSequence) {
        assert.ok(typeof roi.roiNumber === 'number', 'ROI number should be a number');
        assert.ok(typeof roi.roiName === 'string', 'ROI name should be a string');
        assert.ok(roi.roiName.length > 0, 'ROI name should not be empty');
      }
    });

    it('should extract display color for each ROI', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      for (const roi of result.roiSequence) {
        assert.ok(roi.displayColor, 'Display color should exist');
        assert.ok(typeof roi.displayColor.r === 'number', 'Color r should be a number');
        assert.ok(typeof roi.displayColor.g === 'number', 'Color g should be a number');
        assert.ok(typeof roi.displayColor.b === 'number', 'Color b should be a number');
        assert.ok(roi.displayColor.r >= 0 && roi.displayColor.r <= 255, 'Color r should be 0-255');
        assert.ok(roi.displayColor.g >= 0 && roi.displayColor.g <= 255, 'Color g should be 0-255');
        assert.ok(roi.displayColor.b >= 0 && roi.displayColor.b <= 255, 'Color b should be 0-255');
      }
    });

    it('should parse contour sequence with contour data', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      assert.ok(result.contourSequence, 'Contour sequence should exist');
      assert.ok(Array.isArray(result.contourSequence), 'Contour sequence should be an array');

      for (const contour of result.contourSequence) {
        assert.ok(typeof contour.referencedSOPInstanceUID === 'string', 'Referenced SOP should be string');
        assert.ok(typeof contour.referencedROINumber === 'number', 'Referenced ROI number should be number');
        assert.ok(Array.isArray(contour.contourData), 'Contour data should be an array');
        assert.ok(contour.contourData.length >= 3, 'Contour data should have at least 3 values (1 point)');
        // Contour data should be multiples of 3 (x,y,z triplets)
        assert.ok(contour.contourData.length % 3 === 0, 'Contour data length should be divisible by 3');
      }
    });

    it('should throw error for non-existent file', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      await assert.rejects(
        rtStructService.parseRTStruct('/non/existent/path.dcm'),
        { message: /Failed to read DICOM file/i }
      );
    });
  });

  describe('getContoursForSlice', () => {
    it('should return contours for a specific CT slice', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      // Find a SOP instance UID from the contours
      const sampleContour = result.contourSequence[0];
      if (!sampleContour) return;

      const contours = rtStructService.getContoursForSlice(
        result.contourSequence,
        sampleContour.referencedSOPInstanceUID
      );

      assert.ok(Array.isArray(contours), 'Result should be an array');
    });

    it('should return empty array for non-existent slice', async () => {
      const rtStructService = await import('../src/services/rtStructService.js');
      const result = await rtStructService.parseRTStruct(TEST_RTSTRUCT_PATH);

      const contours = rtStructService.getContoursForSlice(
        result.contourSequence,
        'non.existent.sop.instance.uid'
      );

      assert.ok(Array.isArray(contours), 'Result should be an array');
      assert.strictEqual(contours.length, 0, 'Should return empty array for non-existent slice');
    });
  });
});
