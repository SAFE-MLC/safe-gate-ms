import { getTicketFromCache, setTicketInCache } from '../cache.js';
import { fetchTicketWithEntitlements } from '../db.js';

export async function getTicketCachedOrDB(ticketId) {
  let t = await getTicketFromCache(ticketId);
  if (t) return t;

  const fromDb = await fetchTicketWithEntitlements(ticketId);
  if (!fromDb) return null;

  const doc = {
    status: fromDb.status,
    entitlements: fromDb.entitlements,
    eventId: fromDb.eventId,
  };
  await setTicketInCache(ticketId, doc);
  return doc;
}
