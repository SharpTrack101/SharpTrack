const express = require('express');
const router = express.Router();
const prisma = require('./lib/prisma');
const authMiddleware = require('./middleware/auth');

// GET ACTIVITY LOG
router.get('/', authMiddleware, async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;

    try {
        const activities = await prisma.activityLog.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json({ activities });
    } catch (err) {
        console.error('Get activity error:', err.message);
        res.status(500).json({ error: 'Failed to load activity log' });
    }
});

module.exports = router;
