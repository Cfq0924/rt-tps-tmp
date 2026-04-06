import { Router } from 'express';
import upload from '../middleware/upload.js';
import { handleMulterError } from '../middleware/upload.js';
import { validateDicom, validateDicomBatch } from '../middleware/validateDicom.js';
import { registerDicomFile, getDicomFilesByStudy, generateSignedUrl } from '../services/dicomService.js';
import { findOrCreatePatient } from '../services/patientService.js';
import { findOrCreateStudy } from '../services/studyService.js';

const router = Router();

// POST /api/files/upload — upload and parse a DICOM file
router.post('/upload', upload.single('file'), handleMulterError, validateDicom, async (req, res, next) => {
  try {
    const { dicomMetadata } = req;
    const { reqId } = req;

    // Find or create patient
    const patient = findOrCreatePatient({
      externalId: dicomMetadata.patientId || `anon-${dicomMetadata.patientName || 'unknown'}`,
      name: dicomMetadata.patientName || 'Unknown Patient',
      userId: req.user.userId,
      reqId,
    });

    // Find or create study
    const study = findOrCreateStudy({
      patientId: patient.id,
      studyInstanceUid: dicomMetadata.studyInstanceUid,
      userId: req.user.userId,
      reqId,
    });

    // Register the DICOM file
    const fileRecord = registerDicomFile({
      studyId: study.id,
      metadata: dicomMetadata,
      filePath: req.file.path,
      userId: req.user.userId,
      reqId,
    });

    res.status(201).json({
      fileId: fileRecord.id,
      updated: fileRecord.updated,
      studyId: study.id,
      patientId: patient.id,
      metadata: dicomMetadata,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/files/upload-batch — upload multiple DICOM files (e.g., a folder)
router.post('/upload-batch', upload.array('files', 500), handleMulterError, validateDicomBatch, async (req, res, next) => {
  try {
    const { filesWithMetadata } = req;
    const { reqId } = req;
    const userId = req.user.userId;

    // Group files by StudyInstanceUID
    const studyGroups = new Map();
    for (const { file, metadata } of filesWithMetadata) {
      const studyUid = metadata.studyInstanceUid;
      if (!studyGroups.has(studyUid)) {
        studyGroups.set(studyUid, []);
      }
      studyGroups.get(studyUid).push({ file, metadata });
    }

    // Process each study group
    const results = {
      totalFiles: filesWithMetadata.length,
      successful: 0,
      failed: 0,
      studies: [],
    };

    for (const [studyUid, files] of studyGroups) {
      // Find or create patient from first file's metadata
      const firstMeta = files[0].metadata;
      const patient = findOrCreatePatient({
        externalId: firstMeta.patientId || `anon-${firstMeta.patientName || 'unknown'}`,
        name: firstMeta.patientName || 'Unknown Patient',
        userId,
        reqId,
      });

      // Find or create study
      const study = findOrCreateStudy({
        patientId: patient.id,
        studyInstanceUid: studyUid,
        userId,
        reqId,
      });

      const studyResult = {
        studyInstanceUid: studyUid,
        patientId: patient.id,
        patientName: firstMeta.patientName,
        filesImported: 0,
        filesSkipped: 0,
        filesFailed: 0,
      };

      // Register each file in the study
      for (const { file, metadata } of files) {
        try {
          const fileRecord = registerDicomFile({
            studyId: study.id,
            metadata,
            filePath: file.path,
            userId,
            reqId,
          });
          if (fileRecord.updated) {
            studyResult.filesSkipped++;
          } else {
            studyResult.filesImported++;
          }
          results.successful++;
        } catch (err) {
          studyResult.filesFailed++;
          results.failed++;
        }
      }

      studyResult.totalFiles = files.length;
      results.studies.push(studyResult);
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/files/:studyId — list all DICOM files for a study
router.get('/:studyId', async (req, res, next) => {
  try {
    const files = getDicomFilesByStudy({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

// GET /api/files/signed-url/:fileId — generate a signed download URL
router.get('/signed-url/:fileId', async (req, res, next) => {
  try {
    const signedUrl = generateSignedUrl({ fileId: req.params.fileId, reqId: req.id });
    res.json({ url: signedUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
