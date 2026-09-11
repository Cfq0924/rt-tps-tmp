/**
 * PACS interop (Phase 4 M5): C-STORE destinations and the study "send to
 * PACS" flow. Destinations seed once from PACS_AET/PACS_HOST/PACS_PORT env
 * when the table is empty. Sends go through the minimal hand-written C-STORE
 * SCU (dicomnet/scu.js) — see M5 notes for the conformance scope.
 */
import { readFileSync } from 'fs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { sendCStore } from '../dicomnet/scu.js';

const CALLING_AET = process.env.PACS_CALLING_AET || 'MYTPS';

// fallback when a file's Part-10 meta header lacks the SOP class UID
const SOP_CLASS_BY_MODALITY = {
  RTDOSE: '1.2.840.10008.5.1.4.1.481.2',
  RTSTRUCT: '1.2.840.10008.5.1.4.1.481.3',
  RTPLAN: '1.2.840.10008.5.1.4.1.481.4',
  CT: '1.2.840.10008.5.1.4.1.1.2',
};

function hydrate(row) {
  return row ?? null;
}

export function listDestinations({ userId, reqId }) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM pacs_destinations ORDER BY name').all();
  if (rows.length === 0 && process.env.PACS_HOST) {
    // first-run seed from environment
    db.prepare(`
      INSERT INTO pacs_destinations (name, aet, host, port, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'Default PACS',
      process.env.PACS_AET || 'UNKNOWN_AET',
      process.env.PACS_HOST,
      Number(process.env.PACS_PORT) || 104,
      'seeded from environment',
    );
    return listDestinations({ userId, reqId });
  }
  return rows.map(hydrate);
}

export function createDestination({ name, aet, host, port, description, userId, reqId }) {
  const db = getDb();
  if (!name || !aet || !host || !port) {
    throw Object.assign(new Error('name, aet, host and port are required'), { status: 400 });
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw Object.assign(new Error('port must be an integer in 1..65535'), { status: 400 });
  }
  const existing = db.prepare('SELECT id FROM pacs_destinations WHERE name = ?').get(name);
  if (existing) {
    throw Object.assign(new Error('a destination with this name already exists'), { status: 409 });
  }
  const info = db.prepare(`
    INSERT INTO pacs_destinations (name, aet, host, port, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, aet, host, portNum, description ?? null);
  auditLog(db, {
    reqId, userId,
    action: 'create_pacs_destination', resourceType: 'pacs_destination', resourceId: info.lastInsertRowid,
    metadata: { name, host, port: portNum },
  });
  return hydrate(db.prepare('SELECT * FROM pacs_destinations WHERE id = ?').get(info.lastInsertRowid));
}

function getDestination(db, id) {
  const row = db.prepare('SELECT * FROM pacs_destinations WHERE id = ?').get(id);
  if (!row) throw Object.assign(new Error('PACS destination not found'), { status: 404 });
  return row;
}

/**
 * Push the given DICOM files of a study to a destination via C-STORE.
 * Each file is sent on its own association; failures are per-file.
 * @returns {Promise<{results: Array<{fileId:number, fileName:string, ok:boolean, detail:string}>, sent:number, failed:number}>}
 */
export async function sendToPacs({ destinationId, fileIds, callingAet = CALLING_AET, userId, reqId }) {
  const db = getDb();
  const dest = getDestination(db, destinationId);
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw Object.assign(new Error('fileIds must be a non-empty array'), { status: 400 });
  }

  const results = [];
  let sent = 0;
  let failed = 0;
  for (const fileId of fileIds) {
    const file = db.prepare('SELECT id, file_path, file_name, sop_instance_uid, modality FROM dicom_files WHERE id = ?').get(fileId);
    if (!file) {
      results.push({ fileId, fileName: null, ok: false, detail: 'file not found' });
      failed++;
      continue;
    }
    let fileBuf;
    try {
      fileBuf = readFileSync(file.file_path);
    } catch (err) {
      results.push({ fileId, fileName: file.file_name, ok: false, detail: `read failed: ${err.message}` });
      failed++;
      continue;
    }
    const result = await sendCStore({
      host: dest.host,
      port: dest.port,
      calledAet: dest.aet,
      callingAet,
      fileBuf,
      sopClassUid: SOP_CLASS_BY_MODALITY[file.modality] ?? null,
      sopInstanceUid: file.sop_instance_uid ?? null,
    });
    results.push({
      fileId,
      fileName: file.file_name,
      ok: result.ok,
      detail: result.detail,
    });
    if (result.ok) sent++; else failed++;
  }

  auditLog(db, {
    reqId, userId,
    action: 'send_to_pacs',
    resourceType: 'pacs_destination', resourceId: dest.id,
    metadata: { destination: dest.name, fileIds, sent, failed },
  });

  return { destination: { id: dest.id, name: dest.name, aet: dest.aet }, results, sent, failed };
}
