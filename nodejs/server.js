// server.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('./sqlite-session-store'); 
const path = require('path');
const hbs = require('hbs');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const chatRoutes = require('./routes/chat');
const commentsRoutes = require('./routes/comment');

const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3010;

const server = http.createServer(app);

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
  db: path.join(__dirname, 'alm.db'),
  table: 'sessions'
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

app.use(sessionMiddleware);

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
app.use('/profile', profileRoutes);
app.use('/chat', chatRoutes);
app.use('/comment', commentsRoutes);

// Helper function for comment pagination
hbs.registerHelper('range', function(start, end) {
    let arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
});

hbs.registerHelper('ifEquals', function(a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
});


// Socker.IO setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Share session with Socket.IO (official method)
io.engine.use(sessionMiddleware);

// Socket.IO connection handler
io.on('connection', (socket) => {
    const session = socket.request.session;
    
    // Check if user is authenticated
    if (!session.isLoggedIn) {
        socket.emit('error', { 
            message: 'Please log in to use Socket.IO features' 
        });
        socket.disconnect();
        return;
    }
    
    const username = session.username;
    const userId = session.userId;
    
    console.log(`User ${username} (ID: ${userId}) connected via Socket.IO`);
    
    // Send welcome message
    socket.emit('connected', {
        message: `Welcome ${username}!`,
        userId: userId,
        loginTime: session.loginTime
    });
    
    // Listen for authenticated requests
    socket.on('getUserInfo', () => {
        socket.emit('userInfo', {
            username: username,
            userId: userId,
            loginTime: session.loginTime
        });
    });
    
    socket.on('sendMessage', (data) => {
        // Broadcast message with user info
        io.emit('message', {
            username: username,
            userId: userId,
            message: data.message,
            timestamp: new Date().toISOString()
        });
        
        const timestamp = new Date().toISOString();
        // Store in DB
        db.prepare(`
            INSERT INTO chat_messages (user_id, message, created_at)
            VALUES (?, ?, ?)
        `).run(userId, data.message, timestamp);
    });
    
    socket.on('disconnect', () => {
        console.log(`User ${username} disconnected`);
    });
});


// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown, this will help the session to close the db gracefully since we're now using it.
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});
