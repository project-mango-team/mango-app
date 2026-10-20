import express from 'express';
import multer from 'multer';
import { requireApiToken } from '../middleware/apiToken.js';
import { ingestDocument, ingestAviso } from '../controllers/ingestController.js';

// Rutas para integraciones: se autentican con token personal, no con la sesión
const router = express.Router();

router.use(requireApiToken('ingest'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

router.post('/documents', upload.single('file'), ingestDocument);
router.post('/avisos', ingestAviso);

export default router;
