import express from 'express';
import { config } from './config.js';
import { router as validateRoutes } from './routes/validate.js';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.use(validateRoutes);

app.listen(config.PORT, () => {
  console.log(`Gate MS listening on :${config.PORT}`);
});
