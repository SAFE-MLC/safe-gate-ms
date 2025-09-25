// routes/validate.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getTicketCachedOrDB } from '../services/tickets.js';
import { consumeTicketPG } from '../db.js';
import { markUsedOnce, setTicketInCache, appendGateLog } from '../cache.js';
import { log } from '../logger.js';

export const router = express.Router();

router.post('/validate/scan', async (req, res) => {
  const started = Date.now();

  try {
    const { qr, gateId } = req.body || {};
    if (!qr || !gateId) {
      log({
        event: 'scan_decision',
        decision: 'DENY',
        reason: 'BAD_REQUEST',
        gateId,
        elapsed_ms: Date.now() - started,
      });
      return res.status(400).json({ error: 'qr and gateId are required' });
    }

    log({
      event: 'scan_attempt',
      gateId,
      has_qr: Boolean(qr),
      eventId: config.EVENT_ID,
    });

    let payload;
    try {
      payload = jwt.verify(qr, config.SESSION_KEY, { algorithms: ['HS256'] });
    } catch {
      log({
        event: 'scan_decision',
        decision: 'DENY',
        reason: 'EXPIRED|INVALID',
        gateId,
        elapsed_ms: Date.now() - started,
      });
      return res.json({ decision: 'DENY', reason: 'EXPIRED|INVALID' });
    }

    const ticketId = payload.sub || payload.tid;
    if (!ticketId || (payload.evt || '') !== config.EVENT_ID) {
      log({
        event: 'scan_decision',
        decision: 'DENY',
        reason: 'INVALID',
        gateId,
        ticketId: ticketId || null,
        elapsed_ms: Date.now() - started,
      });
      return res.json({ decision: 'DENY', reason: 'INVALID' });
    }

    const t = await getTicketCachedOrDB(ticketId);
    if (!t) {
      log({ event: 'scan_decision', decision: 'DENY', reason: 'NOT_FOUND', gateId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'NOT_FOUND' });
    }
    if (t.eventId !== config.EVENT_ID) {
      log({ event: 'scan_decision', decision: 'DENY', reason: 'INVALID', gateId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'INVALID' });
    }
    if (t.status !== 'ACTIVE') {
      log({ event: 'scan_decision', decision: 'DENY', reason: t.status, gateId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: t.status });
    }

    const first = await markUsedOnce(ticketId);
    if (!first) {
      log({ event: 'scan_decision', decision: 'DENY', reason: 'USED', gateId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'USED' });
    }

    const ok = await consumeTicketPG(ticketId, gateId);
    if (!ok) {
      log({ event: 'scan_decision', decision: 'DENY', reason: 'USED', gateId, ticketId, elapsed_ms: Date.now() - started });
      return res.json({ decision: 'DENY', reason: 'USED' });
    }

    t.status = 'USED';
    await setTicketInCache(ticketId, t);
    await appendGateLog(config.EVENT_ID, { ticketId, gateId, ts: Date.now() });

    log({
      event: 'scan_decision',
      decision: 'ALLOW',
      gateId,
      ticketId,
      elapsed_ms: Date.now() - started,
      entitlements_count: Array.isArray(t.entitlements) ? t.entitlements.length : 0,
    });

    return res.json({ decision: 'ALLOW', ticketId, entitlements: t.entitlements });
  } catch (e) {
    log({
      level: 'error',
      event: 'scan_error',
      msg: e?.message || 'unknown_error',
      stack: e?.stack || null,
      elapsed_ms: Date.now() - started,
    });
    return res.status(500).json({ error: 'internal_error' });
  }
});
