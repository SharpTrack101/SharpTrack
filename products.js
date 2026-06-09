const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// MIDDLEWARE - verify token
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

// ADD PRODUCT
router.post('/', authMiddleware, async (req, res) => {
    const { name, sellingPrice, quantity, reorderLevel, unit } = req.body;

    if (!name || !sellingPrice || !quantity) {
        return res.status(400).json({ error: 'Name, price and quantity are required' });
    }

    try {
        const product = await prisma.product.create({
            data: {
                name,
                sellingPrice: parseFloat(sellingPrice),
                quantity: parseInt(quantity),
                reorderLevel: parseInt(reorderLevel) || 5,
                unit: unit || 'pieces',
                userId: req.userId
            }
        });
        res.status(201).json({ message: 'Product added', product });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET ALL PRODUCTS
router.get('/', authMiddleware, async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ products });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE PRODUCT
router.put('/:id', authMiddleware, async (req, res) => {
    const { name, sellingPrice, quantity, reorderLevel, unit } = req.body;

    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { name, sellingPrice: parseFloat(sellingPrice), quantity: parseInt(quantity), reorderLevel: parseInt(reorderLevel), unit }
        });
        res.json({ message: 'Product updated', product });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE PRODUCT
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.product.delete({ where: { id: req.params.id } });
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
