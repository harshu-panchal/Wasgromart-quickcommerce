/**
 * Direct SMS India HUB API test - bypasses all app code
 * Run: node test-sms-direct.js 9876543210
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const http = require('http');
const querystring = require('querystring');

const MOBILE = process.argv[2] || '9876543210';
const OTP = '1234';

const API_KEY = process.env.SMS_INDIA_HUB_API_KEY ? process.env.SMS_INDIA_HUB_API_KEY.trim() : '';
const SENDER_ID = process.env.SMS_INDIA_HUB_SENDER_ID ? process.env.SMS_INDIA_HUB_SENDER_ID.trim() : '';
const DLT_ID = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID ? process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID.trim() : '';
const APP_NAME = process.env.APP_NAME || 'Wasgromart';

const mobile_with_cc = '91' + MOBILE.replace(/\D/g, '').slice(-10);
const MSG = 'Welcome to the ' + APP_NAME + ' powered by Appzeto.Your OTP for registration is ' + OTP + '.BGADEC';

console.log('\n========================================');
console.log('SMS India HUB - Direct API Test');
console.log('========================================');
console.log('Mobile (normalized):', mobile_with_cc);
console.log('API Key:', API_KEY ? (API_KEY.substring(0,6) + '****') : 'NOT SET');
console.log('Sender ID:', SENDER_ID);
console.log('DLT Template ID:', DLT_ID);
console.log('Message:', MSG);
console.log('Message length:', MSG.length);
console.log('========================================\n');

if (!API_KEY || !SENDER_ID) {
  console.error('ERROR: Missing API_KEY or SENDER_ID in .env');
  process.exit(1);
}

function testHttp(params, label) {
  return new Promise(function(resolve) {
    var qs = querystring.stringify(params);
    var options = {
      hostname: 'cloud.smsindiahub.in',
      path: '/vendorsms/pushsms.aspx?' + qs,
      method: 'GET'
    };
    console.log('[' + label + '] Path preview: /vendorsms/pushsms.aspx?APIKey=***&msisdn=' + mobile_with_cc + '&sid=' + SENDER_ID + '...');
    
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        console.log('[' + label + '] HTTP Status:', res.statusCode);
        console.log('[' + label + '] Raw Response:', data);
        resolve(data);
      });
    });
    req.on('error', function(err) {
      console.error('[' + label + '] ERROR:', err.message);
      resolve(null);
    });
    req.setTimeout(15000, function() {
      console.error('[' + label + '] TIMEOUT');
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function run() {
  var base = { APIKey: API_KEY, msisdn: mobile_with_cc, sid: SENDER_ID, msg: MSG, DLT_TE_ID: DLT_ID };

  console.log('--- TEST 1: No gwid (auto-route) ---');
  await testHttp(base, 'NO_GWID');

  console.log('\n--- TEST 2: gwid=1 (Transactional) ---');
  await testHttp(Object.assign({}, base, { gwid: '1' }), 'GWID_1');

  console.log('\n--- TEST 3: gwid=2 (Promotional) ---');
  await testHttp(Object.assign({}, base, { gwid: '2' }), 'GWID_2');
}

run().catch(console.error);
