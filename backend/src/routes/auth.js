import express from 'express';
import passport from 'passport';

const router = express.Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` 
  }),
  (req, res) => {
    // Successful authentication, redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/`);
  }
);

/**
 * GET /api/auth/user
 * Get current authenticated user
 */
router.get('/user', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  res.json({
    success: true,
    data: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error al destruir sesión'
        });
      }
      
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    });
  });
});

/**
 * GET /api/auth/check
 * Check if user is authenticated (for frontend)
 */
router.get('/check', (req, res) => {
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user ? {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture
    } : null
  });
});

export default router;
