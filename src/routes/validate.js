import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getTicketCachedOrDB } from '../services/tickets.js';
import { consumeTicketPG } from '../db.js';
import { markUsedOnce, setTicketInCache, appendGateLog } from '../cache.js';

export const router = express.Router();

router.post('/validate/scan', async (req, res) => {
  try {
    const { qr, gateId } = req.body || {};
    if (!qr || !gateId) return res.status(400).json({ error: 'qr and gateId are required' });

    let payload;
    try {
      payload = jwt.verify(qr, config.SESSION_KEY, { algorithms: ['HS256'] });
    } catch {
      return res.json({ decision: 'DENY', reason: 'EXPIRED|INVALID' });
    }

    const ticketId = payload.sub || payload.tid;
    if (!ticketId || (payload.evt || '') !== config.EVENT_ID) {
      return res.json({ decision: 'DENY', reason: 'INVALID' });
    }

    const t = await getTicketCachedOrDB(ticketId);
    if (!t) return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    if (t.eventId !== config.EVENT_ID) return res.json({ decision: 'DENY', reason: 'INVALID' });
    if (t.status !== 'ACTIVE') return res.json({ decision: 'DENY', reason: t.status }); // USED | REVOKED

    // anti-replay
    const first = await markUsedOnce(ticketId);
    if (!first) return res.json({ decision: 'DENY', reason: 'USED' });

    // persistencia idempotente
    const ok = await consumeTicketPG(ticketId, gateId);
    if (!ok) return res.json({ decision: 'DENY', reason: 'USED' });

    t.status = 'USED';
    await setTicketInCache(ticketId, t);
    await appendGateLog(config.EVENT_ID, { ticketId, gateId, ts: Date.now() });

    return res.json({ decision: 'ALLOW', ticketId, entitlements: t.entitlements });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal_error' });
  }
});
