import pkg from 'pg';
import { config } from './config.js';
const { Pool } = pkg;

export const pool = new Pool(config.PG);

// helpers PG
export async function consumeTicketPG(ticketId, gateId) {
  const { rows } = await pool.query('SELECT consume_ticket($1,$2) AS ok', [ticketId, gateId]);
  return rows[0]?.ok === true;
}

export async function fetchTicketWithEntitlements(ticketId) {
  const q = `
    SELECT t.id AS ticket_id, t.status, t.event_id,
           COALESCE(ARRAY_AGG(ze.zone_id) FILTER (WHERE ze.zone_id IS NOT NULL), '{}') AS entitlements
    FROM tickets t
    LEFT JOIN zone_entitlements ze ON ze.ticket_id = t.id
    WHERE t.id = $1
    GROUP BY t.id, t.status, t.event_id
  `;
  const { rows } = await pool.query(q, [ticketId]);
  if (!rows.length) return null;
  const r = rows[0];
  return { ticketId: r.ticket_id, status: r.status, eventId: r.event_id, entitlements: r.entitlements || [] };
}
