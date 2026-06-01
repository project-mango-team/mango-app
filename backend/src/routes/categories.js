import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { loadDefaultCategoryKeywords } from '../utils/categoryInference.js';

const router = express.Router();

// All category routes require authentication
router.use(requireAuth);

const normalizeKeywordList = (keywords) => {
  if (!Array.isArray(keywords)) return [];

  const cleaned = keywords
    .map((keyword) => String(keyword).trim())
    .filter((keyword) => keyword !== '');

  return [...new Set(cleaned)];
};

const toPlainKeywords = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === 'object') return value;
  return {};
};

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
 * GET /api/categories/keywords
 * Get user's category keyword mappings
 */
router.get('/keywords', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('categoryKeywords categories');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!user.categoryKeywords || user.categoryKeywords.size === 0) {
      user.categoryKeywords = loadDefaultCategoryKeywords();
      await user.save();
    }

    res.json({
      success: true,
      data: toPlainKeywords(user.categoryKeywords)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categories/keywords
 * Update user's category keyword mappings
 */
router.put('/keywords', async (req, res, next) => {
  try {
    const { keywords, category } = req.body;

    const user = await User.findById(req.user._id).select('categoryKeywords categories');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const allowedCategories = new Set(user.categories || []);
    let nextKeywords = toPlainKeywords(user.categoryKeywords);

    if (category) {
      const categoryName = String(category).trim();
      if (!allowedCategories.has(categoryName)) {
        return res.status(400).json({
          success: false,
          message: 'La categoría no existe'
        });
      }

      const normalized = normalizeKeywordList(keywords);
      nextKeywords = { ...nextKeywords, [categoryName]: normalized };
    } else if (keywords && typeof keywords === 'object') {
      nextKeywords = {};
      for (const [catName, list] of Object.entries(keywords)) {
        if (!allowedCategories.has(catName)) {
          continue;
        }
        nextKeywords[catName] = normalizeKeywordList(list);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un objeto de keywords o una categoría'
      });
    }

    user.categoryKeywords = nextKeywords;
    await user.save();

    res.json({
      success: true,
      message: 'Keywords actualizadas exitosamente',
      data: toPlainKeywords(user.categoryKeywords)
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

    if (user.categoryKeywords) {
      const keywordMap = toPlainKeywords(user.categoryKeywords);
      if (Object.prototype.hasOwnProperty.call(keywordMap, decodeURIComponent(oldName))) {
        keywordMap[newNameTrimmed] = keywordMap[decodeURIComponent(oldName)];
        delete keywordMap[decodeURIComponent(oldName)];
        user.categoryKeywords = keywordMap;
      }
    }
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

    if (user.categoryKeywords) {
      const keywordMap = toPlainKeywords(user.categoryKeywords);
      if (Object.prototype.hasOwnProperty.call(keywordMap, categoryName)) {
        delete keywordMap[categoryName];
        user.categoryKeywords = keywordMap;
      }
    }

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
