// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');

/**
 * GET /register - Show registration form (Handlebars)
 */
router.get('/register', (req, res) => {
  res.render('register', {
    user: req.session.isLoggedIn
      ? { name: req.session.username, isLoggedIn: true }
      : { name: "Guest", isLoggedIn: false },
    error: req.query.error
  });
});

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/register?error=' + encodeURIComponent('Username and password are required.'));
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.redirect('/register?error=' +
        encodeURIComponent('Password does not meet requirements: ' + validation.errors.join(', '))
      );
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.redirect('/register?error=' + encodeURIComponent('Username already exists.'));
    }

    const passwordHash = await hashPassword(password);

    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);

    res.render('register-success', { username });

  } catch (error) {
    console.error('Registration error:', error);
    res.render('error', {
      message: 'An internal server error occurred.',
      back: '/register'
    });
  }
});

/**
 * GET /login - Show login form (Handlebars)
 */
router.get('/login', (req, res) => {
  res.render('login', {
    error: req.query.error,
    user: req.session.isLoggedIn
      ? { name: req.session.username, isLoggedIn: true }
      : { name: "Guest", isLoggedIn: false }
  });
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Username and password are required.'));
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    req.session.loginTime = new Date().toISOString();
    req.session.visitCount = 0;

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    res.render('login-success', { username: user.username });

  } catch (error) {
    console.error('Login error:', error);
    res.render('error', {
      message: 'An internal server error occurred.',
      back: '/login'
    });
  }
});

/**
 * GET /logout
 */
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.render('error', {
        message: 'An error occurred while logging out.',
        back: '/'
      });
    }
    res.render('logged-out');
  });
});

/**
 * POST /logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.render('error', {
        message: 'An error occurred while logging out.',
        back: '/'
      });
    }
    res.redirect('/');
  });
});

/**
 * GET /me - Profile (Handlebars)
 */
router.get('/me', (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/login');
  }

  const user = db.prepare(
    'SELECT id, username, created_at, last_login FROM users WHERE id = ?'
  ).get(req.session.userId);

  if (!user) {
    return res.render('error', {
      message: 'User not found.',
      back: '/'
    });
  }

  res.render('profile', {
    user: {
      isLoggedIn: true,
      name: user.username,
      created_at: user.created_at || 'N/A',
      last_login: user.last_login || 'Never',
      visitCount: req.session.visitCount || 0
    }
  });
});

module.exports = router;
