import mongoose from 'mongoose';
import { AppError } from '../middleware/errorHandler.js';
import { listarNotificaciones, contarNoLeidas, marcarLeida, marcarTodasLeidas } from '../services/notificationService.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { notificaciones, noLeidas } = await listarNotificaciones(req.user._id);
    res.json({ success: true, data: notificaciones, noLeidas });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    res.json({ success: true, data: { noLeidas: await contarNoLeidas(req.user._id) } });
  } catch (error) {
    next(error);
  }
};

export const readNotification = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !(await marcarLeida(req.user._id, req.params.id))) {
      throw new AppError('Notificación no encontrada', 404);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const readAllNotifications = async (req, res, next) => {
  try {
    res.json({ success: true, data: { marcadas: await marcarTodasLeidas(req.user._id) } });
  } catch (error) {
    next(error);
  }
};
