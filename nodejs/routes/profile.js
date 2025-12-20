// routes/profile.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const { requireAuth } = require('../modules/auth-middleware');

// User profile, account management
router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    try {
        // get the user from db
        const dbUser = db.prepare(`
            SELECT * FROM users WHERE id = ?
        `).get(userId);

        // get user's comments for recent comments
        const comments = db.prepare(`
            SELECT * FROM comments 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all(userId);

        // add session info to user passed into profile for handlebars nav. 
        const user = {
            ...dbUser,                 
            isLoggedIn: true,          
            name: req.session.username,
        };
        
        // render profile page with user's options and users comments
        res.render('profile', {
            title: 'My Profile - Wild West Forum',
            user: user,
            comments: comments,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', {
            title: 'Error - Wild West Forum',
            message: 'Failed to load profile'
        });
    }
});

// Updates user password with validation and requires re-login after successful change
router.post('/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.userId;

        // check All fields exist
        if (!currentPassword || !newPassword || !confirmPassword) {
            
            return res.redirect('/profile?error=' + encodeURIComponent('All fields are required.'));
        }
        
        // check passwords match
        if (newPassword !== confirmPassword) {
            return res.redirect('/profile?error=' + encodeURIComponent('Passwords do not match.'));
        }
        
        // check password meets requirements
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return res.redirect(`/profile?error=${encodeURIComponent(validation.errors.join(', '))}`);
        }

        // Get current password hash and check it to current password
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        const passwordMatch = await comparePassword(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.redirect('/profile?error=' + encodeURIComponent("Current password is invalid."));
        }

        // update password and upload to db 
        const newHash = await hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

        // reset session and send to login
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.redirect('/login?error=' + encodeURIComponent("Password Changed! Please login again."));
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.redirect('/profile?error=' + encodeURIComponent("Failed to update password."));
    }
});

// Updates email address with login verification 
router.post('/email', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newEmail, confirmEmail } = req.body;
        const userId = req.session.userId;

        // check all fields filled
        if (!currentPassword || !newEmail || !confirmEmail) {
            return res.redirect('/profile?error=' + encodeURIComponent('All fields are required.'));
        }
        
        // check new emails match
        if (newEmail !== confirmEmail) {
            return res.redirect('/profile?error=' + encodeURIComponent('New Email does not match.'));
        }
        
        // check email is in correct email format
        if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.redirect('/profile?error=' + encodeURIComponent('Invalid email format.'));
        }

        // check if email is in use
        const existingUser = db.prepare(`
            SELECT id FROM users WHERE email = ? AND id != ?
        `).get(newEmail, userId);
        
        if (existingUser) {
            return res.redirect('/profile?error=' + encodeURIComponent('Email already in use.'));
        }
        
        // Check password 
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        const passwordMatch = await comparePassword(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.redirect('/profile?error=' + encodeURIComponent('Current password is incorrect'));
        }

        // update db email and show user it updated
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, userId);
        res.redirect('/profile?success=' + encodeURIComponent('Email updated successfully'));
    } catch (error) {
        console.error('Error updating email:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update email'));
    }
});

// Updates display name - prevent duplicates
router.post('/display-name', requireAuth, (req, res) => {
    try {
        const { displayName } = req.body;
        const userId = req.session.userId;
        
        // ensure filled
        if (!displayName || displayName.trim().length === 0) {
            return res.redirect('/profile?error=' + encodeURIComponent('Display name is required'));
        }

        // prevent duplicates
        const existing = db.prepare('SELECT id FROM users WHERE display_name = ? AND id != ?').get(displayName.trim(), userId);
        if (existing) {
            return res.redirect('/profile?error=' + encodeURIComponent('Display name already in use.'));
        }

        // update db and let user know it updated
        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId);
        res.redirect('/profile?success=' + encodeURIComponent('Display name updated successfully'));
    } catch (error) {
        console.error('Error updating display name:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update display name'));
    }
});

// Updates user profile customization options including name color and bio
router.post('/customization', requireAuth, (req, res) => {
    try {
        // Stores data so if unchanged will set again to same value
        const { nameColor, bio } = req.body;
        const userId = req.session.userId;
        
        // ensure color is in format
        const colorRegex = /^#[0-9A-F]{6}$/i;
        if (nameColor && !colorRegex.test(nameColor)) {
            return res.redirect('/profile?error=' + encodeURIComponent('Invalid color format'));
        }
        
        // update db with color and bio
        db.prepare(`
            UPDATE users 
            SET name_color = ?,
                bio = ?
            WHERE id = ?
        `).run(nameColor, bio, userId);

        res.redirect('/profile?success=' + encodeURIComponent('Profile updated successfully'));
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update profile'));
    }
});

module.exports = router;