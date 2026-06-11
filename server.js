const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Security & parsing middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// API Routes
const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

const productRoutes = require('./products');
app.use('/api/products', productRoutes);

const salesRoutes = require('./sales');
app.use('/api/sales', salesRoutes);

const otpRoutes = require('./otp');
app.use('/api/otp', otpRoutes);

const notificationRoutes = require('./notifications');
app.use('/api/notifications', notificationRoutes);

const activityRoutes = require('./activity');
app.use('/api/activity', activityRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SharpTrack API is running', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SharpTrack server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/health`);
    console.log(`App: http://localhost:${PORT}`);
});