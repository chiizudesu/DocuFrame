const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { XeroAccessToken, XeroIdToken, XeroClient, Organisation } = require('xero-node');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'http://localhost:5173/oauth/callback.html';
const XERO_SCOPES = 'openid profile email accounting.settings accounting.transactions accounting.contacts accounting.journals.read accounting.reports.read accounting.attachments';

// Initialize Xero client
const xero = new XeroClient({
  clientId: XERO_CLIENT_ID,
  clientSecret: XERO_CLIENT_SECRET,
  redirectUris: [XERO_REDIRECT_URI],
  scopes: XERO_SCOPES.split(' '),
  state: 'returnPage', // optional state value
  httpTimeout: 3000, // ms (optional)
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../build')));

// Session middleware for token storage
app.use(session({
  secret: process.env.SESSION_SECRET || 'xero-oauth-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// In-memory token store (use Redis/Database in production)
const tokenStore = new Map();

// OAuth 2.0 endpoints
app.post('/api/xero/auth/initiate', async (req, res) => {
  console.log('🚀 /api/xero/auth/initiate called');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  try {
    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
      console.error('Xero credentials not configured');
      return res.status(500).json({ error: 'Xero credentials not configured' });
    }

    // Generate state for security
    const state = Math.random().toString(36).substring(2, 15);
    req.session.oauthState = state;

    // Accept prompt from request body
    const { prompt } = req.body;
    let authUrl = await xero.buildConsentUrl();
    if (prompt) {
      authUrl += `&prompt=${encodeURIComponent(prompt)}`;
    }

    console.log('Generated auth URL:', authUrl);
    res.json({ authUrl });
    
  } catch (error) {
    console.error('Auth initiate error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate OAuth flow',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/xero/organizations', async (req, res) => {
  console.log('🏢 /api/xero/organizations called');
  console.log('Request body:', req.body);
  
  try {
    const { code, state } = req.body;

    if (!code) {
      console.error('Authorization code missing');
      return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
      console.error('Xero credentials not configured');
      return res.status(500).json({ error: 'Xero credentials not configured' });
    }

    // Exchange authorization code for access token using Xero SDK
    const tokenSet = await xero.apiCallback(XERO_REDIRECT_URI + '?code=' + code + (state ? ('&state=' + state) : ''));
    
    if (!tokenSet || !tokenSet.access_token) {
      console.error('Failed to obtain access token');
      return res.status(500).json({ error: 'Failed to obtain access token' });
    }

    // Set token for API calls
    await xero.setTokenSet(tokenSet);

    // Store token in session for future use
    req.session.tokenSet = tokenSet;

    // Get all tenant connections using Xero SDK
    const connectionsResponse = await xero.updateTenants(false);
    
    // Get organisations for each tenant
    const organizations = [];
    
    for (const tenant of xero.tenants) {
      try {
        // Get organisation details using the accounting API
        const orgResponse = await xero.accountingApi.getOrganisations(tenant.tenantId);
        
        if (orgResponse.body && orgResponse.body.organisations) {
          orgResponse.body.organisations.forEach(org => {
            organizations.push({
              xeroName: org.name || org.legalName || `Organization ${organizations.length + 1}`,
              orgCode: tenant.tenantId, // Use tenant ID as org code
              tenantId: tenant.tenantId,
              organisationId: org.organisationID,
              countryCode: org.countryCode,
              baseCurrency: org.baseCurrency
            });
          });
        }
      } catch (orgError) {
        console.warn(`Failed to fetch organisation for tenant ${tenant.tenantId}:`, orgError.message);
        // Add tenant info even if org details fail
        organizations.push({
          xeroName: tenant.tenantName || `Organization ${organizations.length + 1}`,
          orgCode: tenant.tenantId,
          tenantId: tenant.tenantId
        });
      }
    }

    console.log(`Successfully fetched ${organizations.length} organizations`);
    res.json({ organizations });

  } catch (error) {
    console.error('Organizations fetch error:', error);
    
    // Handle specific Xero SDK errors
    if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
      res.status(401).json({ error: 'Invalid or expired authorization' });
    } else if (error.response?.status === 403 || error.message?.includes('Forbidden')) {
      res.status(403).json({ error: 'Insufficient permissions' });
    } else if (error.message?.includes('timeout')) {
      res.status(408).json({ error: 'Request timeout - please try again' });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch organizations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Additional Xero endpoints using SDK
app.get('/api/xero/reports/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type = 'BalanceSheet' } = req.query;
    
    if (!req.session.tokenSet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await xero.setTokenSet(req.session.tokenSet);
    
    let report;
    switch (type) {
      case 'BalanceSheet':
        report = await xero.accountingApi.getReportBalanceSheet(tenantId);
        break;
      case 'ProfitAndLoss':
        report = await xero.accountingApi.getReportProfitAndLoss(tenantId);
        break;
      case 'TrialBalance':
        report = await xero.accountingApi.getReportTrialBalance(tenantId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    res.json(report.body);
  } catch (error) {
    console.error('Report fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

app.get('/api/xero/bank-transactions/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!req.session.tokenSet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await xero.setTokenSet(req.session.tokenSet);
    
    const bankTransactions = await xero.accountingApi.getBankTransactions(tenantId);
    res.json(bankTransactions.body);
  } catch (error) {
    console.error('Bank transactions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bank transactions' });
  }
});

app.get('/api/xero/contacts/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!req.session.tokenSet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await xero.setTokenSet(req.session.tokenSet);
    
    const contacts = await xero.accountingApi.getContacts(tenantId);
    res.json(contacts.body);
  } catch (error) {
    console.error('Contacts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Token refresh endpoint
app.post('/api/xero/refresh-token', async (req, res) => {
  try {
    if (!req.session.tokenSet || !req.session.tokenSet.refresh_token) {
      return res.status(401).json({ error: 'No refresh token available' });
    }
    
    await xero.setTokenSet(req.session.tokenSet);
    const newTokenSet = await xero.refreshToken();
    
    req.session.tokenSet = newTokenSet;
    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Disconnect endpoint
app.post('/api/xero/disconnect', async (req, res) => {
  try {
    if (req.session.tokenSet) {
      await xero.setTokenSet(req.session.tokenSet);
      await xero.disconnect();
    }
    
    req.session.destroy();
    res.json({ message: 'Successfully disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    xeroConfigured: !!(XERO_CLIENT_ID && XERO_CLIENT_SECRET),
    authenticated: !!req.session?.tokenSet
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 DocuFrame Server running on port ${PORT}`);
  console.log(`📊 Xero OAuth configured: ${!!XERO_CLIENT_ID}`);
  console.log(`🔐 Xero Client ID: ${XERO_CLIENT_ID ? XERO_CLIENT_ID.substring(0, 8) + '...' : 'Not set'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📂 Redirect URI: ${XERO_REDIRECT_URI}`);
});

// Cleanup old sessions and tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (now - value.created > 10 * 60 * 1000) { // 10 minutes
      tokenStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes 