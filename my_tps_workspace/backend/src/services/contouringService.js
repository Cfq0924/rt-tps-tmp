import { auditLog } from '../logging/index.js';
import { getDb } from '../db/init.js';

const AI_ENDPOINT = process.env.AI_CONTOURING_ENDPOINT || 'http://localhost:8080/segment';
const AI_TIMEOUT_MS = 60_000;

export async function autoSegment({ dicomFilePath, organName, userId, reqId }) {
  auditLog(getDb(), { reqId, userId, action: 'auto_segment_start', metadata: { dicomFilePath, organName } });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dicomFilePath, organName }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await response.text();
      throw Object.assign(new Error(`AI contouring failed: ${response.status} ${detail}`), { status: 502 });
    }

    const result = await response.json();

    auditLog(getDb(), { reqId, userId, action: 'auto_segment_complete', metadata: { organName, success: true } });

    return result;
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      throw Object.assign(new Error('AI contouring timed out after 60 seconds'), { status: 504 });
    }

    auditLog(getDb(), { reqId, userId, action: 'auto_segment_error', metadata: { organName, error: err.message } });
    throw err;
  }
}
