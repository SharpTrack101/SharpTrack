const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// RECORD A SALE
router.post('/', authMiddleware, async (req, res) => {
    const { productId, quantitySold, paymentMethod } = req.body;

    if (!productId || !quantitySold) {
        return res.status(400).json({ error: 'Product and quantity are required' });
    }

    try {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (product.quantity < quantitySold) return res.status(400).json({ error: 'Not enough stock' });

        const totalAmount = product.sellingPrice * quantitySold;

        const sale = await prisma.sale.create({
            data: {
                productId,
                quantitySold: parseInt(quantitySold),
                totalAmount,
                paymentMethod: paymentMethod || 'cash',
                userId: req.userId
            }
        });

        await prisma.product.update({
            where: { id: productId },
            data: { quantity: product.quantity - quantitySold }
        });

        res.status(201).json({ message: 'Sale recorded', sale });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET TODAY'S SALES
router.get('/today', authMiddleware, async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId, soldAt: { gte: start } },
            include: { product: true },
            orderBy: { soldAt: 'desc' }
        });

        const total = sales.reduce((sum, s) => sum + s.totalAmount, 0);
        res.json({ sales, total });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET LAST 5 SALES
router.get('/recent', authMiddleware, async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId },
            include: { product: true },
            orderBy: { soldAt: 'desc' },
            take: 5
        });
        res.json({ sales });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;