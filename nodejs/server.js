const express = require('express');
const session = require('express-session'); // Add this line
const app = express();
const path = require('path');
const hbs = require('hbs');

const PORT = 3010;

// app.use(express.static(('public')));

// Set view engine and views directory
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse form submits
app.use(express.urlencoded({ extended: false }));

// Session middleware configuration - Add this block
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Home page - now reads session data
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

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle login form submission - now sets session data
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // Simple authentication (in production, use proper password hashing)
    if (username && password) {
        // Set session data
        req.session.isLoggedIn = true;
        req.session.username = username;
        req.session.loginTime = new Date().toISOString();
        req.session.visitCount = 0;
        
        console.log(`User ${username} logged in at ${req.session.loginTime}`);
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

// Logout route - Add this new route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

// Profile page - now requires login
app.get('/profile', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    
    const user = {
        name: req.session.username,
        loginTime: req.session.loginTime,
        visitCount: req.session.visitCount || 0
    };
    
    res.render('profile', { user: user });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
