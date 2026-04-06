import { describe, it } from 'node:test';
import assert from 'node:assert';

const TEST_RTDOSE_PATH = '/home/cfq/AI/vibe-coding/rt-tps-tmp/test_data/patient1/RD.1.2.246.352.71.7.891085747523.595.20241110204624.dcm';

describe('rtDoseService', () => {
  describe('parseRTDose', () => {
    it('should parse RTDOSE file and return dose data', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(result, 'Result should exist');
      assert.ok(result.doseGridScaling, 'Dose grid scaling should exist');
      assert.ok(typeof result.doseGridScaling === 'number', 'Dose grid scaling should be a number');
    });

    it('should extract dose type and units', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(result.doseType, 'Dose type should exist');
      assert.ok(result.doseUnits, 'Dose units should exist');
      assert.ok(typeof result.doseType === 'string', 'Dose type should be a string');
      assert.ok(typeof result.doseUnits === 'string', 'Dose units should be a string');
    });

    it('should extract grid dimensions (rows, columns, frames)', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(typeof result.rows === 'number', 'Rows should be a number');
      assert.ok(typeof result.columns === 'number', 'Columns should be a number');
      assert.ok(typeof result.numberOfFrames === 'number', 'Number of frames should be a number');
      assert.ok(result.rows > 0, 'Rows should be positive');
      assert.ok(result.columns > 0, 'Columns should be positive');
      assert.ok(result.numberOfFrames > 0, 'Number of frames should be positive');
    });

    it('should extract image position and orientation', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(result.imagePosition, 'Image position should exist');
      assert.ok(typeof result.imagePosition.x === 'number', 'Image position x should be a number');
      assert.ok(typeof result.imagePosition.y === 'number', 'Image position y should be a number');
      assert.ok(typeof result.imagePosition.z === 'number', 'Image position z should be a number');

      assert.ok(result.imageOrientation, 'Image orientation should exist');
      assert.ok(Array.isArray(result.imageOrientation.x), 'Orientation x should be an array');
      assert.ok(Array.isArray(result.imageOrientation.y), 'Orientation y should be an array');
      assert.ok(Array.isArray(result.imageOrientation.z), 'Orientation z should be an array');
    });

    it('should extract pixel spacing', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(result.pixelSpacing, 'Pixel spacing should exist');
      assert.ok(typeof result.pixelSpacing.i === 'number', 'Pixel spacing i should be a number');
      assert.ok(typeof result.pixelSpacing.j === 'number', 'Pixel spacing j should be a number');
      assert.ok(result.pixelSpacing.i > 0, 'Pixel spacing i should be positive');
      assert.ok(result.pixelSpacing.j > 0, 'Pixel spacing j should be positive');
    });

    it('should return pixel data as typed array', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const result = await rtDoseService.parseRTDose(TEST_RTDOSE_PATH);

      assert.ok(result.pixelData, 'Pixel data should exist');
      assert.ok(result.pixelData instanceof Float32Array || result.pixelData instanceof Uint16Array,
        'Pixel data should be Float32Array or Uint16Array');
      assert.ok(result.pixelData.length > 0, 'Pixel data should not be empty');
    });

    it('should throw error for non-existent file', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      await assert.rejects(
        rtDoseService.parseRTDose('/non/existent/path.dcm'),
        { message: /Failed to read DICOM file/i }
      );
    });
  });

  describe('calculateDoseValue', () => {
    it('should calculate dose values from pixel data and scaling', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const pixelData = new Uint16Array([0, 1000, 2000, 3000]);
      const doseGridScaling = 0.0001;

      const result = rtDoseService.calculateDoseValue(pixelData, doseGridScaling);

      assert.ok(result instanceof Float32Array, 'Result should be Float32Array');
      assert.strictEqual(result.length, 4, 'Result should have same length as input');
      // doseGridScaling * 100 = 0.0001 * 100 = 0.01
      // 1000 * 0.01 = 10 (cGy)
      assert.strictEqual(result[1], 10, 'Second value should be 1000 * 0.0001 * 100 = 10 cGy');
    });

    it('should handle empty pixel data', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const pixelData = new Uint16Array([]);
      const doseGridScaling = 0.0001;

      const result = rtDoseService.calculateDoseValue(pixelData, doseGridScaling);

      assert.ok(result instanceof Float32Array, 'Result should be Float32Array');
      assert.strictEqual(result.length, 0, 'Result should be empty');
    });

    it('should return zeros for zero pixel data', async () => {
      const rtDoseService = await import('../src/services/rtDoseService.js');
      const pixelData = new Uint16Array([0, 0, 0, 0]);
      const doseGridScaling = 0.0001;

      const result = rtDoseService.calculateDoseValue(pixelData, doseGridScaling);

      assert.ok(result instanceof Float32Array, 'Result should be Float32Array');
      assert.ok(result.every(v => v === 0), 'All values should be zero');
    });
  });
});
