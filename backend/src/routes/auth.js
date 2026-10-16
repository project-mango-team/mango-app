import express from 'express';
import passport from 'passport';
import User from '../models/User.js';

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

/**
 * Login de invitado para desarrollo local, sin Google.
 * Solo existe si DEV_GUEST_LOGIN=true (lo setea nodemon.json, o sea `npm run dev`),
 * NODE_ENV no es production y la conexión viene de localhost.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const isDevGuestEnabled = () =>
  process.env.DEV_GUEST_LOGIN === 'true' && process.env.NODE_ENV !== 'production';

if (isDevGuestEnabled()) {
  console.warn('⚠️  DEV_GUEST_LOGIN activo: POST /api/auth/dev-login habilitado (solo localhost)');

  router.post('/dev-login', async (req, res, next) => {
    try {
      // remoteAddress es el socket real; no depende de X-Forwarded-For
      if (!LOOPBACK.has(req.socket.remoteAddress)) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      const user = await User.findOneAndUpdate(
        { googleId: 'dev-guest' },
        {
          $setOnInsert: { googleId: 'dev-guest', email: 'guest@mango.local', name: 'Invitado (dev)' },
          $set: { lastLogin: new Date() }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ success: true, data: { _id: user._id, email: user.email, name: user.name } });
      });
    } catch (error) {
      next(error);
    }
  });
}

export default router;
