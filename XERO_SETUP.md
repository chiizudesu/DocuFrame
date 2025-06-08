# Xero OAuth Integration Setup (SDK-Powered)

## Prerequisites

1. **Xero Developer Account**: Create an account at [developer.xero.com](https://developer.xero.com)
2. **Xero App**: Create a new app in your Xero developer dashboard

## Configuration Steps

### 1. Xero App Configuration

In your Xero developer dashboard:
- Create a new app
- Set the redirect URI to: `http://localhost:3000/oauth/callback.html`
- Note down your Client ID and Client Secret
- Enable the following scopes:
  - `openid`
  - `profile`
  - `email`
  - `accounting.settings`
  - `accounting.transactions`
  - `accounting.contacts`
  - `accounting.journals.read`
  - `accounting.reports.read`
  - `accounting.attachments`

### 2. Environment Variables

Create a `.env` file in the root directory with:

```env
# Xero OAuth Configuration
XERO_CLIENT_ID=cvd your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=http://localhost:3000/oauth/callback.html

# Server Configuration
PORT=3001
SESSION_SECRET=your_random_session_secret_here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies (if not already done)
cd ..
npm install
```

### 4. Run the Application

```bash
# Terminal 1: Start the backend server
cd server
npm run dev

# Terminal 2: Start the React app
npm start
```

## Features

### Organization Management
- **Complete Organization Data**: View organization names, tenant IDs, country codes, and base currencies
- **Real-time Sync**: Direct integration with Xero's official API using the Node.js SDK
- **Enhanced Export**: CSV export includes all organization details

### Additional API Endpoints
The integration now provides access to:
- **Reports**: Balance Sheet, Profit & Loss, Trial Balance (`/api/xero/reports/:tenantId`)
- **Bank Transactions**: Access bank transaction data (`/api/xero/bank-transactions/:tenantId`)
- **Contacts**: Retrieve contact information (`/api/xero/contacts/:tenantId`)
- **Token Management**: Automatic token refresh and session management

## Usage

1. Click the "Org Codes" button in the Xero tab
2. Click "Connect to Xero" in the dialog
3. Complete OAuth authentication in the popup
4. View comprehensive organization data in the table:
   - Organization Name
   - Tenant ID (for API calls)
   - Country Code
   - Base Currency
5. Export detailed CSV with all organization information

## Troubleshooting

- **Popup blocked**: Ensure popups are allowed for localhost
- **OAuth errors**: Check your Xero app configuration and credentials
- **CORS issues**: Ensure the backend server is running on port 3001
- **No organizations**: Verify your Xero account has connected organizations

## Technical Benefits

### Official Xero SDK Integration
- **Robust Error Handling**: Built-in retry logic and error handling
- **Type Safety**: Full TypeScript support with proper types
- **Automatic Token Management**: Handles token refresh automatically
- **Rate Limiting**: Built-in rate limiting compliance
- **Security**: OAuth 2.0 PKCE flow with secure token storage

### Performance Optimizations
- **Session-based Authentication**: Efficient token storage using sessions
- **Concurrent API Calls**: Parallel organization data fetching
- **Caching**: In-memory token caching for improved performance

## Security Notes

- Never commit your `.env` file to version control
- Use environment-specific redirect URIs for production
- Session secret should be a strong random string in production
- Implement proper token storage for production (Redis/Database)
- Add rate limiting and request validation for production use
- Enable HTTPS in production environments 