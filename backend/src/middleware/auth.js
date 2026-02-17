/**
 * Middleware to require authentication
 * Blocks request if user is not authenticated
 */
export const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado. Por favor inicia sesión.',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  // User is authenticated, proceed
  next();
};

/**
 * Middleware for optional authentication
 * Attaches user if present, but doesn't block request
 */
export const optionalAuth = (req, res, next) => {
  // User will be attached by passport if session exists
  // Just continue regardless
  next();
};

/**
 * Middleware to check if user owns a resource
 * Must be used after requireAuth
 */
export const checkOwnership = (model, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      const resource = await model.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Recurso no encontrado'
        });
      }
      
      // Check if resource belongs to user
      if (resource.user_id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso',
          code: 'FORBIDDEN'
        });
      }
      
      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};
