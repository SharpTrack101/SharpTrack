const express = require('express');
const router = express.Router();
const prisma = require('./lib/prisma');
const authMiddleware = require('./middleware/auth');

// RECORD A SALE
router.post('/', authMiddleware, async (req, res) => {
    const { productId, quantitySold, paymentMethod } = req.body;

    if (!productId || !quantitySold) {
        return res.status(400).json({ error: 'Product and quantity are required' });
    }

    if (parseInt(quantitySold) <= 0) {
        return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    try {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (product.userId !== req.userId) return res.status(403).json({ error: 'Access denied' });
        if (product.quantity < quantitySold) return res.status(400).json({ error: 'Not enough stock. Available: ' + product.quantity });

        const totalAmount = product.sellingPrice * parseInt(quantitySold);

        const sale = await prisma.sale.create({
            data: {
                productId,
                quantitySold: parseInt(quantitySold),
                totalAmount,
                paymentMethod: paymentMethod || 'cash',
                userId: req.userId,
                productName: product.name,
                unitPrice: product.sellingPrice
            }
        });

        // Update stock
        const newQuantity = product.quantity - parseInt(quantitySold);
        await prisma.product.update({
            where: { id: productId },
            data: { quantity: newQuantity }
        });

        // Check for low stock and create notification
        if (newQuantity <= product.reorderLevel && newQuantity > 0) {
            try {
                await prisma.notification.create({
                    data: {
                        userId: req.userId,
                        type: 'warning',
                        title: 'Low Stock Alert',
                        message: `${product.name} is running low (${newQuantity} ${product.unit} remaining). Consider restocking soon.`
                    }
                });
            } catch (e) { /* notification creation is non-critical */ }
        }

        if (newQuantity === 0) {
            try {
                await prisma.notification.create({
                    data: {
                        userId: req.userId,
                        type: 'error',
                        title: 'Out of Stock!',
                        message: `${product.name} is now out of stock. Restock immediately to avoid missed sales.`
                    }
                });
            } catch (e) { /* non-critical */ }
        }

        res.status(201).json({ message: 'Sale recorded', sale });
    } catch (err) {
        console.error('Record sale error:', err.message);
        res.status(500).json({ error: 'Failed to record sale' });
    }
});

// GET ALL SALES
router.get('/', authMiddleware, async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sellingPrice: true,
                        unit: true
                    }
                }
            },
            orderBy: { soldAt: 'desc' }
        });
        res.json({ sales });
    } catch (err) {
        console.error('Get all sales error:', err.message);
        res.status(500).json({ error: 'Failed to load sales history' });
    }
});

// GET TODAY'S SALES
router.get('/today', authMiddleware, async (req, res) => {
    let timezoneOffset = -60; // Default to Nigeria (UTC+1)
    if (req.query.timezoneOffset !== undefined) {
        timezoneOffset = parseInt(req.query.timezoneOffset);
    }
    const now = new Date();
    const localNow = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
    localNow.setUTCHours(0, 0, 0, 0);
    const start = new Date(localNow.getTime() + (timezoneOffset * 60 * 1000));

    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId, soldAt: { gte: start } },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sellingPrice: true,
                        unit: true
                    }
                }
            },
            orderBy: { soldAt: 'desc' }
        });

        const total = sales.reduce((sum, s) => sum + s.totalAmount, 0);

        // Calculate yesterday's total for comparison
        const yesterdayStart = new Date(start);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdaySales = await prisma.sale.findMany({
            where: { 
                userId: req.userId, 
                soldAt: { gte: yesterdayStart, lt: start } 
            }
        });
        const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.totalAmount, 0);

        let percentChange = 0;
        if (yesterdayTotal > 0) {
            percentChange = Math.round(((total - yesterdayTotal) / yesterdayTotal) * 100);
        }

        res.json({ sales, total, yesterdayTotal, percentChange, salesCount: sales.length });
    } catch (err) {
        console.error('Get today sales error:', err.message);
        res.status(500).json({ error: 'Failed to load sales data' });
    }
});

// GET LAST 5 SALES
router.get('/recent', authMiddleware, async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sellingPrice: true,
                        unit: true
                    }
                }
            },
            orderBy: { soldAt: 'desc' },
            take: 5
        });
        res.json({ sales });
    } catch (err) {
        console.error('Get recent sales error:', err.message);
        res.status(500).json({ error: 'Failed to load recent sales' });
    }
});

// GET SALES STATS
router.get('/stats', authMiddleware, async (req, res) => {
    let timezoneOffset = -60; // Default to Nigeria (UTC+1)
    if (req.query.timezoneOffset !== undefined) {
        timezoneOffset = parseInt(req.query.timezoneOffset);
    }
    const now = new Date();
    const localNow = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
    localNow.setUTCHours(0, 0, 0, 0);
    const today = new Date(localNow.getTime() + (timezoneOffset * 60 * 1000));

    try {
        const todaySales = await prisma.sale.findMany({
            where: { userId: req.userId, soldAt: { gte: today } }
        });

        const allSales = await prisma.sale.findMany({
            where: { userId: req.userId }
        });

        const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const allTimeTotal = allSales.reduce((sum, s) => sum + s.totalAmount, 0);

        res.json({
            todayTotal,
            todaySalesCount: todaySales.length,
            allTimeTotal,
            allTimeSalesCount: allSales.length
        });
    } catch (err) {
        console.error('Get sales stats error:', err.message);
        res.status(500).json({ error: 'Failed to load sales stats' });
    }
});

// GET WEEKLY SALES (Last 7 Days)
router.get('/weekly', authMiddleware, async (req, res) => {
    let timezoneOffset = -60; // Default to Nigeria (UTC+1)
    if (req.query.timezoneOffset !== undefined) {
        timezoneOffset = parseInt(req.query.timezoneOffset);
    }
    const now = new Date();
    const localNow = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
    localNow.setUTCHours(0, 0, 0, 0);
    
    // 7 days including today starts at: localNow - 6 days
    const start = new Date(localNow.getTime() - (6 * 24 * 60 * 60 * 1000) + (timezoneOffset * 60 * 1000));

    try {
        const sales = await prisma.sale.findMany({
            where: {
                userId: req.userId,
                soldAt: { gte: start }
            },
            orderBy: { soldAt: 'asc' }
        });

        // Initialize last 7 days mapping
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyData = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(localNow.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateStr = d.toISOString().split('T')[0];
            weeklyData.push({
                dayName: days[d.getUTCDay()],
                dateString: dateStr,
                amount: 0,
                count: 0
            });
        }

        // Helper to convert date to local date string
        const getLocalDateString = (date, offset) => {
            const localTime = new Date(date.getTime() - (offset * 60 * 1000));
            return localTime.toISOString().split('T')[0];
        };

        // Aggregate sales by date
        sales.forEach(sale => {
            const saleDate = getLocalDateString(sale.soldAt, timezoneOffset);
            const target = weeklyData.find(item => item.dateString === saleDate);
            if (target) {
                target.amount += sale.totalAmount;
                target.count += 1;
            }
        });

        res.json({ weekly: weeklyData });
    } catch (err) {
        console.error('Get weekly sales error:', err.message);
        res.status(500).json({ error: 'Failed to load weekly sales' });
    }
});

// GET TOP-SELLING PRODUCTS
router.get('/top-products', authMiddleware, async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            where: { userId: req.userId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        unit: true
                    }
                }
            }
        });

        const productSales = {};
        sales.forEach(s => {
            if (!s.product) return;
            if (!productSales[s.productId]) {
                productSales[s.productId] = {
                    id: s.productId,
                    name: s.product.name,
                    quantity: 0,
                    revenue: 0,
                    unit: s.product.unit
                };
            }
            productSales[s.productId].quantity += s.quantitySold;
            productSales[s.productId].revenue += s.totalAmount;
        });

        const sorted = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        res.json({ topProducts: sorted });
    } catch (err) {
        console.error('Get top products error:', err.message);
        res.status(500).json({ error: 'Failed to load top products' });
    }
});

module.exports = router;