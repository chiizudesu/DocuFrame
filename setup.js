#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(__dirname, '.env');

console.log('🚀 DocuFrame Xero OAuth Setup\n');

function generateRandomSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupEnvironment() {
  console.log('📝 Let\'s configure your Xero OAuth credentials:\n');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await askQuestion('❓ .env file already exists. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Setup cancelled. Existing .env file preserved.');
      rl.close();
      return;
    }
  }

  // Get Xero credentials
  const clientId = await askQuestion('🔑 Enter your Xero Client ID: ');
  const clientSecret = await askQuestion('🔐 Enter your Xero Client Secret: ');
  
  // Generate session secret
  const sessionSecret = generateRandomSecret();
  
  // Default values
  const redirectUri = 'http://localhost:3000/oauth/callback.html';
  const port = '3001';
  const nodeEnv = 'development';
  const frontendUrl = 'http://localhost:3000';

  // Create .env content
  const envContent = `# Xero OAuth Configuration
XERO_CLIENT_ID=${clientId}
XERO_CLIENT_SECRET=${clientSecret}
XERO_REDIRECT_URI=${redirectUri}

# Server Configuration
PORT=${port}
SESSION_SECRET=${sessionSecret}
NODE_ENV=${nodeEnv}
FRONTEND_URL=${frontendUrl}

# Generated on ${new Date().toISOString()}
`;

  try {
    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Environment configuration created successfully!');
    console.log('📁 File location:', envPath);
    console.log('\n📋 Configuration summary:');
    console.log(`   Client ID: ${clientId.substring(0, 8)}...`);
    console.log(`   Client Secret: ${clientSecret.substring(0, 8)}...`);
    console.log(`   Redirect URI: ${redirectUri}`);
    console.log(`   Server Port: ${port}`);
    console.log(`   Session Secret: Generated (${sessionSecret.substring(0, 8)}...)`);
    
    console.log('\n🔒 Security Notes:');
    console.log('   ⚠️  Never commit the .env file to version control');
    console.log('   ⚠️  Keep your credentials secure and private');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. cd server && npm install');
    console.log('   2. npm run dev (start the backend server)');
    console.log('   3. npm start (start the React app in another terminal)');
    
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
  }
  
  rl.close();
}

async function validateSetup() {
  console.log('🔍 Validating Xero OAuth setup...\n');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found. Run setup first.');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      envVars[key.trim()] = value.trim();
    }
  });
  
  const required = [
    'XERO_CLIENT_ID',
    'XERO_CLIENT_SECRET', 
    'XERO_REDIRECT_URI',
    'PORT',
    'SESSION_SECRET'
  ];
  
  let isValid = true;
  
  required.forEach(key => {
    if (envVars[key]) {
      console.log(`✅ ${key}: ${envVars[key].substring(0, 20)}...`);
    } else {
      console.log(`❌ ${key}: Missing`);
      isValid = false;
    }
  });
  
  if (isValid) {
    console.log('\n🎉 Configuration is valid! Ready to start the servers.');
  } else {
    console.log('\n❌ Configuration incomplete. Please run setup again.');
  }
  
  return isValid;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--validate') || args.includes('-v')) {
    await validateSetup();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage:');
    console.log('  node setup.js          - Interactive setup');
    console.log('  node setup.js -v       - Validate configuration');
    console.log('  node setup.js -h       - Show help');
  } else {
    await setupEnvironment();
  }
}

main().catch(console.error); 