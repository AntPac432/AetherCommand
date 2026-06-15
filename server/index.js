import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './routes.js';
import { initDb } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRouter);

initDb();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[AetherCommand] API server running on http://localhost:${PORT}`));
