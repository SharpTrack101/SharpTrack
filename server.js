const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

const otpRoutes = require('./otp');
app.use('/api/otp', otpRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'SharpTrack API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});