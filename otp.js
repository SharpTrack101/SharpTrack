const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const getSupabase = () => createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Store OTPs temporarily in memory
const otpStore = {};

// SEND OTP
router.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    try {
        await axios.post('https://www.bulksmsnigeria.com/api/v2/sms', {
            from: 'SharpTrack',
            to: phone,
            body: `Your SharpTrack verification code is: ${otp}. Valid for 5 minutes.`,
            api_token: process.env.BULKSMS_TOKEN
        });

        res.json({ message: 'OTP sent successfully' });
    
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
    const { phone, otp, business_name } = req.body;

    const record = otpStore[phone];
    if (!record) return res.status(400).json({ error: 'OTP not found. Request a new one.' });
    if (Date.now() > record.expires) return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    delete otpStore[phone];

    const email = `${phone}@sharptrack.app`;
    const password = `ST_${phone}_${otp}`;

    const { data, error } = await getsupabase().signUp({
        email,
        password,
        options: { data: { phone, business_name } }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Account created successfully', user: data.user });
});

// LOGIN WITH PHONE
router.post('/login', async (req, res) => {
    const { phone, otp } = req.body;

    const record = otpStore[phone];
    if (!record) return res.status(400).json({ error: 'OTP not found. Request a new one.' });
    if (Date.now() > record.expires) return res.status(400).json({ error: 'OTP expired.' });
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    delete otpStore[phone];

    const email = `${phone}@sharptrack.app`;
    const password = `ST_${phone}_${otp}`;

    const { data, error } = await getsupabase().signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ message: 'Login successful', session: data.session });
});

module.exports = router;