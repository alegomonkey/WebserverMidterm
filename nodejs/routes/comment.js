// routes/comment.js
const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /comment?page=1
// paginated comments
router.get('/', (req, res) => {
    // amount of comments per page
    const perPage = 6;
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    // get # of comments
    const totalComments = db.prepare(`SELECT COUNT(*) AS count FROM comments`).get().count;
    const totalPages = Math.ceil(totalComments / perPage);

    if (page > totalPages && totalPages !== 0) {
        return res.redirect(`/comment?page=${totalPages}`);
    }

    const offset = (page - 1) * perPage;

    // get comments by page
    const comments = db.prepare(`
        SELECT 
            c.*,
            u.display_name AS author
        FROM comments c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    `).all(perPage, offset);

    // parse timestamp
    comments.forEach(c => {
        const date = new Date(c.created_at);
        c.timestamp = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    });

    // check user is logged in
    const user = req.session.isLoggedIn
        ? { name: req.session.username, isLoggedIn: true }
        : { isLoggedIn: false };

    // Goto page
    res.render('comments', {
        title: 'Town Gossip',
        comments,
        user,
        page,
        totalPages,
        totalComments,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page - 1,
        nextPage: page + 1
    });
});

// GET /comment/new
router.get('/new', (req, res) => {
    const user = req.session.isLoggedIn
        ? { name: req.session.username, isLoggedIn: true }
        : { isLoggedIn: false };

    res.render('new-comment', {
        title: 'Write Gossip',
        user
    });
});

// POST /comment
router.post('/', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }

    const text = req.body.text;
    const userId = req.session.userId;

    // insert comment to db
    db.prepare(`
        INSERT INTO comments (user_id, text)
        VALUES (?, ?)
    `).run(userId, text);

    res.redirect('/comment');
});

// POST /comment/:id/vote
router.post('/:id/vote', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false, error: "Login required" });
    }

    const userId = req.session.userId;
    const commentId = parseInt(req.params.id);
    const vote = parseInt(req.body.reaction);
    // prevent excess votes
    if (![1, -1].includes(vote)) {
        return res.status(400).json({ success: false, error: "Invalid vote" });
    }

    try {
        // prevent multiple votes per comment
        const existing = db.prepare(`
            SELECT vote FROM comment_user_votes
            WHERE user_id = ? AND comment_id = ?
        `).get(userId, commentId);

        if (!existing) {
            db.prepare(`
                INSERT INTO comment_user_votes (user_id, comment_id, vote)
                VALUES (?, ?, ?)
            `).run(userId, commentId, vote);

            db.prepare(`
                UPDATE comments SET votes = votes + ?
                WHERE id = ?
            `).run(vote, commentId);

        // update vote (swap vote)
        } else if (existing.vote !== vote) {
            db.prepare(`
                UPDATE comment_user_votes
                SET vote = ?
                WHERE user_id = ? AND comment_id = ?
            `).run(vote, userId, commentId);

            db.prepare(`
                UPDATE comments SET votes = votes + ?
                WHERE id = ?
            `).run(vote * 2, commentId);
        }

        // overall score of votes
        const score = db.prepare(`
            SELECT votes FROM comments WHERE id = ?
        `).get(commentId).votes;

        res.json({ success: true, score });

    } catch (err) {
        console.error("Vote error:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

module.exports = router;