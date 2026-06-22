const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/auth');
const OpenAI = require('openai');
const axios = require('axios');

let glmClient = null;

function getGLMClient() {
    if (!glmClient) {
        const apiKey = process.env.GLM_API_KEY;
        if (!apiKey) {
            throw new Error('GLM_API_KEY environment variable is not configured');
        }
        glmClient = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://open.bigmodel.cn/api/paas/v4/'
        });
    }
    return glmClient;
}

async function callAI(systemPrompt, message) {
    const client = getGLMClient();
    const response = await client.chat.completions.create({
        model: 'glm-4-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ]
    });
    return response.choices[0].message.content;
}

// POST /api/chat
router.post('/', authMiddleware, async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const systemPrompt = `You are SharpTrack AI, a smart and friendly inventory assistant for Nigerian provision store owners.

Your job is to understand what the user wants even if they say it casually, in broken English, or Nigerian Pidgin.

Examples of what users might say and what they mean:
- "abeg add 50 milo" → add_product: Milo, qty 50
- "I don sell 5 fanta" → record_sale: Fanta, qty 5
- "how many peak milk I get" → check_stock: Peak Milk
- "wetin dey run low" → low_stock
- "update indomie price to 650" → update_price: Indomie, ₦650
- "make indomie 700 naira" → update_price: Indomie, ₦700
- "today sales" → daily_summary
- "how e go today" → daily_summary
- "sup", "hey", "hello", "how far" → greeting

Rules:
1. Always try your best to understand the intent even if words are missing
2. If you're 70% sure of the intent, act on it and confirm with the user
3. Only ask for clarification if you genuinely cannot determine the product or quantity
4. Never give the same error message twice
5. Respond in a friendly, conversational Nigerian tone
6. Keep responses short and clear

Return ONLY valid JSON:
{
  "intent": "add_product|update_price|check_stock|low_stock|record_sale|daily_summary|greeting|unknown",
  "product": "product name or null",
  "quantity": number or null,
  "price": number or null,
  "confidence": 0.0 to 1.0,
  "reply": "friendly response for greeting/unknown/clarification"
}
Do NOT include any text outside the JSON object.`;

        let geminiJson;

        if (process.env.GLM_API_KEY) {
            try {
                const rawText = await callAI(systemPrompt, `User query: "${message}"`);
                // Strip markdown code fences if GLM wraps the JSON in them
                const cleaned = rawText.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
                geminiJson = JSON.parse(cleaned);
            } catch (glmErr) {
                console.error('GLM API call failed, falling back to local parser:', glmErr.message);
                // If GLM_API_KEY is invalid or GLM is unreachable, fall through to local parser
                geminiJson = null;
            }
        }

        if (!geminiJson) {
            console.warn("GLM_API_KEY not configured. Using local fallback parser for testing.");
            
            // Helper functions for fallback parsing
            const capitalizeWords = (str) => str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            // Extract the user query if wrapped in the prompt template
            let query = message;
            const marker = 'User query: "';
            const markerIdx = message.indexOf(marker);
            if (markerIdx !== -1) {
                query = message.substring(markerIdx + marker.length);
                if (query.endsWith('"')) {
                    query = query.slice(0, -1);
                }
            }

            const msg = query.toLowerCase().trim();
            // Clean punctuation but preserve letters, spaces, and currency symbols
            const cleanMsg = msg.replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();

            // ── 1. Add Stock ─────────────────────────────────────────────────
            // Standard: "add 50 milo", "put 10 peak", "buy 5 indomie"
            // Pidgin:   "abeg add 50 milo", "abeg put 20 peak"
            const addMatch =
                cleanMsg.match(/(?:abeg\s+)?(?:add|put|buy)\s+(\d+)\s+(.+?)(?:\s+at\s+(?:n|₦|naira)?\s*(\d+))?$/i) ||
                cleanMsg.match(/(?:abeg\s+)?(?:add|put|buy)\s+(.+?)\s+(\d+)(?:\s+at\s+(?:n|₦|naira)?\s*(\d+))?$/i);

            // ── 2. Record Sale ───────────────────────────────────────────────
            // Standard: "sold 5 fanta", "sell 3 milo"
            // Pidgin:   "I don sell 5 fanta", "I just sell 2 milo", "I sell 5 fanta"
            const saleMatch =
                cleanMsg.match(/(?:i\s+(?:don|just|don\s+just)\s+)?(?:sold?|sell|recorded?)\s+(\d+)\s+(.+)$/i) ||
                cleanMsg.match(/(?:i\s+(?:don|just|don\s+just)\s+)?(?:sold?|sell|recorded?)\s+(.+?)\s+(\d+)$/i);

            // ── 3. Update Price ──────────────────────────────────────────────
            // Standard: "update indomie price to 650", "set price of milo to 800"
            // Pidgin:   "make indomie 700 naira", "make indomie 700", "change indomie price to 700"
            const priceMatch =
                cleanMsg.match(/(?:update|change|set)\s+(.+?)\s+price\s+to\s+(\d+)/i) ||
                cleanMsg.match(/(?:update|change|set)\s+price\s+of\s+(.+?)\s+to\s+(\d+)/i) ||
                cleanMsg.match(/make\s+(.+?)\s+(\d+)(?:\s+naira)?/i) ||
                cleanMsg.match(/(.+?)\s+price\s+(?:is\s+now|now)\s+(\d+)/i);

            // ── 4. Check Stock ───────────────────────────────────────────────
            // Standard: "how many milo do I have"
            // Pidgin:   "how many peak milk I get", "how many indomie I get remaining"
            const checkMatch =
                cleanMsg.match(/how\s+many\s+(.+?)(?:\s+(?:do\s+)?i\s+(?:have|get)|\s+remaining|\s+left|\s+dey)?$/i) ||
                cleanMsg.match(/(?:check\s+stock\s+of|stock\s+(?:level\s+)?of|check)\s+(.+)$/i);

            // ── 5. Low Stock ─────────────────────────────────────────────────
            // Pidgin:   "wetin dey run low", "wetin dey finish"
            const isLowStock =
                /(?:wetin\s+dey\s+(?:run\s+)?low|wetin\s+dey\s+finish)/.test(cleanMsg) ||
                cleanMsg.includes("running low") || cleanMsg.includes("low stock") ||
                cleanMsg.includes("run low") || cleanMsg.includes("alerts") ||
                cleanMsg.includes("dey finish");

            // ── 6. Daily Summary ─────────────────────────────────────────────
            // Pidgin:   "how e go today", "how today go"
            const isSummary =
                /how\s+(?:e\s+go|today\s+go)/.test(cleanMsg) ||
                cleanMsg.includes("today sales") || cleanMsg.includes("today\'s sales") ||
                cleanMsg.includes("summary") || cleanMsg.includes("daily report") ||
                (cleanMsg.includes("today") && cleanMsg.includes("sale")) ||
                (cleanMsg.includes("today") && cleanMsg.includes("report"));

            // ── 7. Greeting ──────────────────────────────────────────────────
            const isGreeting =
                /^(?:hi|hey|hello|sup|howdy|how\s+far|how\s+now|na\s+wao?|oya|good\s+(?:morning|afternoon|evening)|what(?:'s|s)\s+up|how\s+are\s+you|morning|afternoon|evening)\b/.test(cleanMsg);

            if (addMatch && !cleanMsg.match(/\b(?:sell|sold|sale)\b/)) {
                // Determine which capture group holds qty vs product
                let qty, prod, priceStr;
                if (/^\d+$/.test(addMatch[1])) {
                    qty = parseInt(addMatch[1], 10);
                    prod = addMatch[2];
                    priceStr = addMatch[3];
                } else {
                    prod = addMatch[1];
                    qty = parseInt(addMatch[2], 10);
                    priceStr = addMatch[3];
                }
                prod = prod.replace(/\b(?:at|naira|₦)\b.*/i, '').trim();
                const price = priceStr ? parseInt(priceStr, 10) : null;

                geminiJson = {
                    intent: "add_product",
                    product: capitalizeWords(prod),
                    quantity: qty,
                    price: price,
                    confidence: 0.9,
                    reply: null
                };
            } else if (saleMatch) {
                let qty, prod;
                if (/^\d+$/.test(saleMatch[1])) {
                    qty = parseInt(saleMatch[1], 10);
                    prod = saleMatch[2];
                } else {
                    prod = saleMatch[1];
                    qty = parseInt(saleMatch[2], 10);
                }
                prod = prod.replace(/\bnaira\b.*/i, '').trim();

                geminiJson = {
                    intent: "record_sale",
                    product: capitalizeWords(prod),
                    quantity: qty,
                    price: null,
                    confidence: 0.9,
                    reply: null
                };
            } else if (priceMatch) {
                const prod = priceMatch[1].trim();
                const price = parseInt(priceMatch[2], 10);

                geminiJson = {
                    intent: "update_price",
                    product: capitalizeWords(prod),
                    quantity: null,
                    price: price,
                    confidence: 0.9,
                    reply: null
                };
            } else if (checkMatch) {
                let prod = checkMatch[1].trim();
                prod = prod.replace(/\b(?:do\s+i\s+have|i\s+get|remaining|left|stock|dey)\b/gi, '').trim();

                geminiJson = {
                    intent: "check_stock",
                    product: capitalizeWords(prod),
                    quantity: null,
                    price: null,
                    confidence: 0.85,
                    reply: null
                };
            } else if (isLowStock) {
                geminiJson = {
                    intent: "low_stock",
                    product: null,
                    quantity: null,
                    price: null,
                    confidence: 0.95,
                    reply: null
                };
            } else if (isSummary) {
                geminiJson = {
                    intent: "daily_summary",
                    product: null,
                    quantity: null,
                    price: null,
                    confidence: 0.9,
                    reply: null
                };
            } else if (isGreeting) {
                geminiJson = {
                    intent: "greeting",
                    product: null,
                    quantity: null,
                    price: null,
                    confidence: 1.0,
                    reply: "E don do! 👋 I'm SharpTrack AI. Wetin you need? I fit help you add stock, record sales, check prices, or show today's summary."
                };
            } else {
                geminiJson = {
                    intent: "unknown",
                    product: null,
                    quantity: null,
                    price: null,
                    confidence: 0.0,
                    reply: null
                };
            }
        }

        const { intent, product, quantity, price } = geminiJson;

        const PORT = process.env.PORT || 3000;
        const apiBase = `http://localhost:${PORT}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization // Forward the user's JWT token
        };

        let responseMessage = '';

        switch (intent) {
            case 'add_product': {
                if (!product || quantity === null || price === null) {
                    responseMessage = "Abeg, tell me the product name, how many you want to add, and the price (e.g. 'Add 20 Milo at ₦1900').";
                    break;
                }

                // Check if product already exists
                const getRes = await axios.get(`${apiBase}/api/products`, { headers });
                const products = getRes.data.products || [];
                const existing = products.find(p => p.name.toLowerCase() === product.toLowerCase());

                if (existing) {
                    // Update existing
                    const newQuantity = existing.quantity + quantity;
                    await axios.put(`${apiBase}/api/products/${existing.id}`, {
                        quantity: newQuantity,
                        sellingPrice: price
                    }, { headers });

                    responseMessage = `Oya, I have updated *${existing.name}*. Added ${quantity} unit(s). New stock level: ${newQuantity}. Selling price set to ₦${price.toLocaleString()}.`;
                } else {
                    // Create new
                    await axios.post(`${apiBase}/api/products`, {
                        name: product,
                        sellingPrice: price,
                        costPrice: price * 0.75, // Default cost price (75% of selling price)
                        quantity: quantity,
                        reorderLevel: 5,
                        unit: 'pieces'
                    }, { headers });

                    responseMessage = `Correct! I have added *${product}* as a new product in your inventory with ${quantity} unit(s) at ₦${price.toLocaleString()} each.`;
                }
                break;
            }

            case 'update_price': {
                if (!product || price === null) {
                    responseMessage = "Abeg, specify the product name and the new price you want to set (e.g. 'Update Indomie price to ₦700').";
                    break;
                }

                const getRes = await axios.get(`${apiBase}/api/products`, { headers });
                const products = getRes.data.products || [];
                const existing = products.find(p => p.name.toLowerCase() === product.toLowerCase());

                if (!existing) {
                    responseMessage = `Ah, I search for *${product}* but I no see am for your inventory list. Confirm the name first.`;
                    break;
                }

                await axios.put(`${apiBase}/api/products/${existing.id}`, {
                    sellingPrice: price
                }, { headers });

                responseMessage = `Done deal! I have updated the price of *${existing.name}* to ₦${price.toLocaleString()}.`;
                break;
            }

            case 'check_stock': {
                if (!product) {
                    responseMessage = "Which product you want to check? Tell me (e.g. 'How many Indomie do I have?').";
                    break;
                }

                const getRes = await axios.get(`${apiBase}/api/products`, { headers });
                const products = getRes.data.products || [];
                const existing = products.find(p => p.name.toLowerCase() === product.toLowerCase());

                if (existing) {
                    responseMessage = `You get **${existing.quantity}** ${existing.unit || 'pieces'} of *${existing.name}* remaining for your shop.`;
                } else {
                    responseMessage = `I no see *${product}* for your inventory list o. Make sure say you add the product first.`;
                }
                break;
            }

            case 'low_stock': {
                const getRes = await axios.get(`${apiBase}/api/products`, { headers });
                const products = getRes.data.products || [];
                const lowStock = products.filter(p => p.quantity <= p.reorderLevel);

                if (lowStock.length === 0) {
                    responseMessage = "Everything dey intact! None of your products is running low for now.";
                } else {
                    const list = lowStock.map(p => `• **${p.name}**: ${p.quantity} left (reorder level: ${p.reorderLevel})`).join('\n');
                    responseMessage = `Abeg take note, these products dey run low:\n\n${list}`;
                }
                break;
            }

            case 'record_sale': {
                if (!product || !quantity) {
                    responseMessage = "To record sale, specify the product and how many you sell (e.g. 'I sold 5 Milo').";
                    break;
                }

                const getRes = await axios.get(`${apiBase}/api/products`, { headers });
                const products = getRes.data.products || [];
                const existing = products.find(p => p.name.toLowerCase() === product.toLowerCase());

                if (!existing) {
                    responseMessage = `Ah, *${product}* no dey your inventory. You must add the product before you fit record sale for am.`;
                    break;
                }

                if (existing.quantity < quantity) {
                    responseMessage = `Insufficient stock! You only get **${existing.quantity}** of *${existing.name}* left, but you want to sell ${quantity}.`;
                    break;
                }

                await axios.post(`${apiBase}/api/sales`, {
                    productId: existing.id,
                    quantitySold: quantity,
                    paymentMethod: 'cash'
                }, { headers });

                const totalAmount = existing.sellingPrice * quantity;
                responseMessage = `Recorded! You just sell ${quantity} *${existing.name}* for a total of ₦${totalAmount.toLocaleString()}. Remaining stock: **${existing.quantity - quantity}**.`;
                break;
            }

            case 'daily_summary': {
                const getRes = await axios.get(`${apiBase}/api/sales/today`, { headers });
                const data = getRes.data;

                if (!data.sales || data.sales.length === 0) {
                    responseMessage = "You never record any sales today. Sales no dey for now.";
                } else {
                    const list = data.sales.map(s => `• ${s.quantitySold}x **${s.productName || 'Product'}** (₦${s.totalAmount.toLocaleString()})`).join('\n');
                    responseMessage = `Here is today's sales summary:\n\n• **Total Revenue**: ₦${data.total.toLocaleString()}\n• **Total Sales Logged**: ${data.salesCount}\n\nTransactions:\n${list}`;
                }
                break;
            }

            case 'greeting': {
                // Use GLM's reply if available, otherwise the fallback reply from geminiJson
                responseMessage = geminiJson.reply || "E don do! 👋 I'm SharpTrack AI. Wetin you need? I fit help you add stock, record sales, check prices, or show today's summary.";
                break;
            }

            case 'unknown':
            default: {
                // Use GLM's clarification reply if it gave one
                const unknownReplies = [
                    "Hmm, I no fully grab that one. Try say: 'add 20 milo', 'I don sell 5 fanta', or 'wetin dey run low'.",
                    "I no understand that command o. You fit rephrase? E.g. 'check indomie stock' or 'today sales'.",
                    "Abeg help me understand — which product, which action? E.g. 'make indomie 700' or 'abeg add 30 peak'."
                ];
                responseMessage = geminiJson.reply || unknownReplies[Math.floor(Math.random() * unknownReplies.length)];
                break;
            }
        }

        res.json({
            success: true,
            response: responseMessage,
            data: geminiJson
        });
    } catch (err) {
        console.error('Chatbot API Error:', err);
        res.status(500).json({
            success: false,
            error: err.response?.data?.error || err.message
        });
    }
});

module.exports = router;
