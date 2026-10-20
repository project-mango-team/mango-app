import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  subirDocumentos,
  getDocumentos,
  getPendientes,
  getTransacciones,
  putParametros,
  postImportar,
  postImportarListos,
  postDescartar
} from '../controllers/bandejaController.js';

const router = express.Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 30 }
});

router.route('/')
  .get(getDocumentos)
  .post(upload.array('files', 30), subirDocumentos);

router.get('/pendientes', getPendientes);
router.post('/importar-listos', postImportarListos);

router.get('/:id/transacciones', getTransacciones);
router.put('/:id/parametros', putParametros);
router.post('/:id/importar', postImportar);
router.post('/:id/descartar', postDescartar);

export default router;
