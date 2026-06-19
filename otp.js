const express = require('express');
const router = express.Router();

// Store OTPs temporarily in memory
const { otpStore } = require('./store');
const { sendSMS } = require('./services/termii');

// SEND OTP
router.post('/send', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
    console.log(`[OTP Generate] OTP for ${phone}: ${otp}`);

    try {
        // Send OTP using Termii SMS Service
        const message = `Your SharpTrack verification code is: ${otp}. It expires in 5 minutes.`;
        await sendSMS(phone, message);
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error(`[OTP Send Error] Failed to send OTP to ${phone}:`, error.message);
        res.status(500).json({ error: `Failed to send OTP: ${error.message}` });
    }
});
// VERIFY OTP
router.post('/verify', async (req, res) => {
    const { phone, otp } = req.body;

    const record = otpStore[phone];
    if (!record) return res.status(400).json({ error: 'OTP not found. Request a new one.' });
    if (Date.now() > record.expires) return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    // Mark phone as verified
    otpStore[phone].verified = true;

    res.json({ message: 'Phone verified successfully', verified: true });
});

// CHECK IF PHONE IS VERIFIED
router.get('/status/:phone', (req, res) => {
    const { phone } = req.params;
    const record = otpStore[phone];
    
    if (!record || !record.verified) {
        return res.json({ verified: false });
    }
    
    res.json({ verified: true });
});

module.exports = router;