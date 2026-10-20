import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getNotifications, getUnreadCount, readNotification, readAllNotifications
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', readAllNotifications);
router.post('/:id/read', readNotification);

export default router;
