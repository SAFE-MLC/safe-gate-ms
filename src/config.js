import 'dotenv/config';

export const config = {
  PORT: process.env.PORT || 8080,
  EVENT_ID: process.env.EVENT_ID || 'evt_1',
  SESSION_KEY: process.env.SESSION_KEY || 'dev_secret',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  PG: {
    host: process.env.PGHOST || 'localhost',
    user: process.env.PGUSER || 'gate_ms',
    password: process.env.PGPASSWORD || 'gate_pw',
    database: process.env.PGDATABASE || 'safe',
    port: Number(process.env.PGPORT || 5432),
  },
};
