import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All category routes require authentication
router.use(requireAuth);

/**
 * GET /api/categories
 * Get user's categories
 */
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('categories');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user.categories || []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/categories
 * Add a new category
 */
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }

    const categoryName = name.trim();

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Check if category already exists (case insensitive)
    const exists = user.categories.some(
      cat => cat.toLowerCase() === categoryName.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'La categoría ya existe'
      });
    }

    user.categories.push(categoryName);
    await user.save();

    res.json({
      success: true,
      message: 'Categoría agregada exitosamente',
      data: user.categories
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categories/:oldName
 * Update a category name
 */
router.put('/:oldName', async (req, res, next) => {
  try {
    const { oldName } = req.params;
    const { newName } = req.body;

    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nuevo nombre de la categoría es requerido'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const categoryIndex = user.categories.findIndex(
      cat => cat === decodeURIComponent(oldName)
    );

    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Check if new name already exists (case insensitive)
    const newNameTrimmed = newName.trim();
    const exists = user.categories.some(
      (cat, idx) => idx !== categoryIndex && cat.toLowerCase() === newNameTrimmed.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    user.categories[categoryIndex] = newNameTrimmed;
    await user.save();

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: user.categories
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/categories/:name
 * Delete a category
 */
router.delete('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const categoryName = decodeURIComponent(name);
    const initialLength = user.categories.length;
    user.categories = user.categories.filter(cat => cat !== categoryName);

    if (user.categories.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente',
      data: user.categories
    });
  } catch (error) {
    next(error);
  }
});

export default router;
