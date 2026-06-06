const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// REGISTER
router.post('/register', async (req, res) => {
    const { email, password, business_name } = req.body;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { business_name }
        }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Account created successfully', user: data.user });
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ message: 'Login successful', session: data.session });
});

module.exports = router;