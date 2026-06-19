const axios = require('axios');

/**
 * Send an SMS message using Termii API
 * @param {string} to - Recipient phone number (e.g., 070... or 23470...)
 * @param {string} message - Message body
 * @returns {Promise<object>} - Termii API response data
 */
async function sendSMS(to, message) {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID || 'SharpTrack';

    if (!apiKey) {
        throw new Error('TERMII_API_KEY is not configured in environment variables');
    }

    // Format phone number to international standard (Nigeria prefix: 234)
    let formattedTo = to.replace(/[^0-9]/g, '');
    if (formattedTo.startsWith('0') && formattedTo.length === 11) {
        formattedTo = '234' + formattedTo.substring(1);
    }

    const payload = {
        api_key: apiKey,
        to: formattedTo,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic' // 'generic' or 'dnd'
    };

    console.log(`[Termii SMS] Sending message to ${formattedTo}...`);

    try {
        const res = await axios.post('https://api.ng.termii.com/api/sms/send', payload);
        console.log('[Termii SMS] Response:', res.data);
        return res.data;
    } catch (err) {
        const errMsg = err.response && err.response.data 
            ? JSON.stringify(err.response.data) 
            : err.message;
        console.error('[Termii SMS] Failed to send SMS:', errMsg);
        throw new Error(`Termii SMS Error: ${errMsg}`);
    }
}

module.exports = { sendSMS };
