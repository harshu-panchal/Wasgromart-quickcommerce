import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log('Env path:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('.env loaded successfully');
}

console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Exists' : 'MISSING');
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Exists' : 'MISSING');
