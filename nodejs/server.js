// server.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('./sqlite-session-store'); // From Chapter 10
const path = require('path');
const hbs = require('hbs');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./modules/auth-middleware');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// TRUST PROXY
app.set('trust proxy', 1);

// Set view engine and views directory
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Session configuration with SQLite store (from Chapter 10)
const sessionStore = new SQLiteStore({
  db: path.join(__dirname, 'sessions.db'),
  table: 'sessions'
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));


// Protected route example (doing this manually by sending)
app.get('/api/protected', requireAuth, (req, res) => {
  res.send(`Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`);
});

app.get('/', (req, res) => {
    let user = {  // We keep the Guest object to act as a default if there is no session
        name: "Guest",
        isLoggedIn: false,
        loginTime: null,
        visitCount: 0
    };
    
    // Check if user is logged in via session
    if (req.session.isLoggedIn) {
        user = {
            name: req.session.username,
            isLoggedIn: true,
            loginTime: req.session.loginTime,
            visitCount: req.session.visitCount || 0
        };
        
        // Increment visit count
        req.session.visitCount = (req.session.visitCount || 0) + 1;
    }
    
    res.render('home', { user: user });
});

// Routes
app.use('/', authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown, this will help the session to close the db gracefully since we're now using it.
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});
