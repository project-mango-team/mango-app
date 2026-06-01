import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import { loadDefaultCategoryKeywords } from '../utils/categoryInference.js';

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Update last login
          user.lastLogin = new Date();
          
          // Ensure user has categories (migration for existing users)
          if (!user.categories || user.categories.length === 0) {
            user.categories = [
              'Transferencia',
              'Transporte',
              'Salud',
              'Supermercado',
              'Comida',
              'Servicios',
              'Ocio',
              'Ropa',
              'Mantenimiento',
              'Ingreso',
              'Otros'
            ];
          }

          if (!user.categoryKeywords || user.categoryKeywords.size === 0) {
            user.categoryKeywords = loadDefaultCategoryKeywords();
          }
          
          await user.save();
          return done(null, user);
        }

        // Create new user (categories will be set by schema default)
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          picture: profile.photos[0]?.value || '',
          lastLogin: new Date(),
          categoryKeywords: loadDefaultCategoryKeywords()
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

export default passport;
