// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');

// GET /register
router.get('/register', (req, res) => {
  res.render('register', {
    user: req.session.isLoggedIn
      ? { name: req.session.username, isLoggedIn: true }
      : { name: "Guest", isLoggedIn: false },
    error: req.query.error
  });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { email, username, display_name, password } = req.body;

    // Check all fields are filled
    if (!username || !password || !email || !display_name) {
      return res.redirect('/register?error=' + encodeURIComponent('Email, Username, Display Username and password are required.'));
    }

    // check password meets requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.redirect('/register?error=' + encodeURIComponent('Password does not meet requirements: ' + validation.errors.join(', ')));
    }

    // Check if Username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.redirect('/register?error=' + encodeURIComponent('Username already exists.'));
    }

    // Check if display name already exists
    const existingDisplayName = db.prepare('SELECT display_name FROM users WHERE display_name = ?').get(display_name);
    if (existingDisplayName) {
      return res.redirect('/register?error=' + encodeURIComponent('Display Name already exists.'));
    }

    // Check if email is already in use
    const existingEmail = db.prepare('SELECT email FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.redirect('/register?error=' + encodeURIComponent('Email in use.'));
    }

    // Hash password & insert into DB all fields
    const passwordHash = await hashPassword(password);

    db.prepare('INSERT INTO users (username, email, display_name, password_hash) VALUES (?, ?, ?, ?)').run(username, email, display_name, passwordHash);

    // pass to success regestration page
    res.render('register-success', { username });

  } catch (error) {
    console.error('Registration error:', error);
    res.render('error', {
      message: 'An internal server error occurred.',
      back: '/register'
    });
  }
});

// GET /login
router.get('/login', (req, res) => {
  res.render('login', {
    error: req.query.error,
    user: req.session.isLoggedIn
      ? { name: req.session.username, isLoggedIn: true }
      : { name: "Guest", isLoggedIn: false }
  });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // check username and password input
    if (!username || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Username and password are required.'));
    }

    // Do not reveal whether username exists or password wrong
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
    }

    // Check if account is locked
    if (user.account_locked_until) {
      const lockedUntil = new Date(user.account_locked_until);
      const now = new Date();

      if (lockedUntil > now) {
        const minutesLeft = Math.ceil((lockedUntil - now) / 60000);
        return res.redirect('/login?error=' +
          encodeURIComponent(`Account locked. Try again in ${minutesLeft} minute(s).`)
        );
      }
    }

    // Compare password
    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      // Increment failed attempts
      const newAttempts = user.failed_login_attempts + 1;

      // Lock account after 5 failed attempts
      if (newAttempts >= 5) {
        const lockMinutes = 15; // lockout duration minutes
        const lockUntil = new Date(Date.now() + lockMinutes * 60000).toISOString();

        db.prepare(`
          UPDATE users
          SET failed_login_attempts = ?, account_locked_until = ?
          WHERE id = ?
        `).run(newAttempts, lockUntil, user.id);

        return res.redirect('/login?error=' + encodeURIComponent(`Too many failed attempts. Account locked for ${lockMinutes} minutes.`));
      }

      // update failed attempts
      db.prepare(`
        UPDATE users
        SET failed_login_attempts = ?
        WHERE id = ?
      `).run(newAttempts, user.id);

      // Do not reveal whether username exists or password wrong
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
    }

    // Successful login - reset counters
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0,
          account_locked_until = NULL,
          last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    req.session.loginTime = new Date().toISOString();
    req.session.visitCount = 0;

    // update db and pass to login-sccess page
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

// GET /logout
router.get('/logout', (req, res) => {
  // destroy session 
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

// POST /logout
router.post('/logout', (req, res) => {
  // destroy session 
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

// GET /me (profile) from template
router.get('/me', (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/login');
  }

  // get session information & check if exists
  const user = db.prepare(
    'SELECT id, username, created_at, last_login FROM users WHERE id = ?'
  ).get(req.session.userId);

  if (!user) {
    return res.render('error', {
      message: 'User not found.',
      back: '/'
    });
  }

  // render profile page
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
