require('dotenv').config();

console.log('🔍 Testing Environment Configuration...\n');

const requiredVars = [
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'XERO_REDIRECT_URI',
  'PORT',
  'SESSION_SECRET'
];

console.log('📋 Environment Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log('\n🎯 Xero OAuth Status:');
console.log(`   Client ID configured: ${!!process.env.XERO_CLIENT_ID}`);
console.log(`   Client Secret configured: ${!!process.env.XERO_CLIENT_SECRET}`);
console.log(`   Redirect URI: ${process.env.XERO_REDIRECT_URI}`);

if (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET) {
  console.log('\n🎉 Environment is properly configured for Xero OAuth!');
  console.log('\n🚀 Ready to start servers:');
  console.log('   Backend: npm run start-backend');
  console.log('   Frontend: npm start');
  console.log('   Both: npm run dev-all');
} else {
  console.log('\n❌ Missing required Xero credentials. Run: npm run setup');
} 