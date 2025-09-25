import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.REDIS_URL);

export async function getTicketFromCache(ticketId) {
  const v = await redis.get(`ticket:${ticketId}`);
  return v ? JSON.parse(v) : null;
}

export async function setTicketInCache(ticketId, doc, ttl = 120) {
  await redis.setex(`ticket:${ticketId}`, ttl, JSON.stringify(doc));
}

export async function markUsedOnce(ticketId) {
  // Anti-replay: éxito solo la primera vez (NX)
  const nx = await redis.set(`used:${ticketId}`, '1', 'NX', 'EX', 300);
  return nx !== null;
}

export async function appendGateLog(eventId, log) {
  await redis.rpush(`scanlog:gate:${eventId}`, JSON.stringify(log));
}
