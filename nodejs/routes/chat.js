// /routes chat.js 
const express = require('express');
const router = express.Router();
const db = require('../database');

// Renders the main chat interface with recent messages and user information
router.get('/', (req, res) => {
    try {
        // get limited in memory messages
        let messages = [];
        if (req.session.user) {
            messages = db.prepare(`
                SELECT cm.*, 
                       u.username, u.display_name, u.name_color
                FROM chat_messages cm
                JOIN users u ON cm.user_id = u.id
                ORDER BY cm.created_at DESC
                LIMIT 50
            `).all();
            
            // format timestamp
            messages.forEach(msg => {
                if (msg.created_at) {
                    const date = new Date(msg.created_at);
                    msg.formattedTime = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            });
            // show most recent first
            messages.reverse();
        }
        
        // render chat page with limited chats
        res.render('chat', {
            title: 'Town Square - Live Chat',
            messages: messages,
            isLoggedIn: true,
            currentUser: req.session.user || null
        });
    } catch (error) {
        console.error('Error loading chat:', error);
        res.status(500).render('error', {
            title: 'Error - Wild West Chat',
            message: 'Failed to load chat'
        });
    }
});

module.exports = router;