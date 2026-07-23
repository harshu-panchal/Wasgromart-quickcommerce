import axios from 'axios';
import Otp from '../models/Otp';

// SMS India HUB Configuration
const SMS_INDIA_HUB_API_KEY = process.env.SMS_INDIA_HUB_API_KEY;
const SMS_INDIA_HUB_SENDER_ID = process.env.SMS_INDIA_HUB_SENDER_ID;
const SMS_INDIA_HUB_DLT_TEMPLATE_ID = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;
const SMS_INDIA_HUB_API_URL = 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
const API_TIMEOUT = 30000; // 30 seconds

if (!SMS_INDIA_HUB_API_KEY || !SMS_INDIA_HUB_SENDER_ID) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('SMS India HUB credentials are not fully set in environment variables');
  }
}

/**
 * Interface for OTP Response
 */
interface OtpResponse {
  success: boolean;
  sessionId?: string;
  message: string;
}

/**
 * SMS India HUB API Response Interface
 */
interface SmsIndiaHubResponse {
  ErrorCode?: string;
  ErrorMessage?: string;
  JobId?: string;
  MessageId?: string;
  MessageData?: Array<{
    Number: string;
    MessageId: string;
    Message: string;
  }>;
}

type UserType = 'Customer' | 'Delivery' | 'Seller' | 'Admin';

/**
 * Generate numeric OTP
 */
function generateOTP(length: number = 4): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * Normalize mobile number to include country code (91)
 *
 * IMPORTANT: detection must be length-aware, not just `startsWith('91')`,
 * because perfectly valid 10-digit Indian numbers can begin with the digits
 * "91" (e.g. 9168560196). If we relied on prefix alone we would skip adding
 * the country code and end up with a 10-digit string that fails the
 * 12-13 digit check.
 */
function normalizeMobileNumber(mobile: string): string {
  let cleanMobile = mobile.replace(/^\+/, '').replace(/\D/g, '');

  // 10 digits → bare Indian mobile, always add country code
  if (cleanMobile.length === 10) {
    cleanMobile = '91' + cleanMobile;
  }
  // 11 digits starting with leading 0 (e.g. 09168560196) → strip 0 and add 91
  else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) {
    cleanMobile = '91' + cleanMobile.substring(1);
  }
  // 12-13 digits already includes country code (or another country code) — leave as-is
  // Anything else falls through and is rejected by the length check below.

  if (cleanMobile.length < 12 || cleanMobile.length > 13) {
    throw new Error(`Invalid mobile number: ${cleanMobile}. Must be 12-13 digits with country code.`);
  }

  return cleanMobile;
}

/**
 * Helper to build candidate message variations for DLT matching
 */
function getOtpMessageCandidates(otp: string): string[] {
  const customAppName = process.env.APP_NAME ? process.env.APP_NAME.trim() : '';

  // Order candidates by highest probability based on registered DLT template:
  // "Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC"
  const brandNames = Array.from(new Set([
    customAppName,
    'Wasgromart',
    'wasgromart',
    'Wasgro',
    'wasgro',
  ])).filter(Boolean);

  const candidates: string[] = [];

  // With .BGADEC suffix (as shown in DLT portal screenshot)
  for (const brand of brandNames) {
    candidates.push(`Welcome to the ${brand} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`);
  }

  // Without .BGADEC suffix (in case operator strips header suffix)
  for (const brand of brandNames) {
    candidates.push(`Welcome to the ${brand} powered by Appzeto.Your OTP for registration is ${otp}`);
  }

  return candidates;
}

/**
 * Parse and handle SMS India HUB API response
 */
function handleSmsResponse(responseData: SmsIndiaHubResponse): void {
  const errorCode = responseData.ErrorCode || '';
  const errorMsg = responseData.ErrorMessage || '';

  // Success indicators
  if (errorCode === '000' || errorMsg === 'Done' || responseData.JobId || responseData.MessageData) {
    return; // Success
  }

  // Error handling
  if (errorCode || errorMsg) {
    switch (errorCode) {
      case '001':
        throw new Error('SMS India HUB: Account details cannot be blank.');
      case '006':
        throw new Error('SMS India HUB: Invalid DLT template. Message does not match registered template.');
      case '007':
        throw new Error('SMS India HUB: Invalid API key or credentials.');
      case '021':
        throw new Error('SMS India HUB: Insufficient credits in your account.');
      default:
        throw new Error(`SMS India HUB API Error (Code: ${errorCode}): ${errorMsg}`);
    }
  }
}

/**
 * Send SMS via SMS India HUB API with automatic candidate fallback on DLT error
 */
async function sendSmsViaApi(mobile: string, otpOrMessage: string): Promise<void> {
  const apiKey = (process.env.SMS_INDIA_HUB_API_KEY || '').trim();
  const senderId = (process.env.SMS_INDIA_HUB_SENDER_ID || '').trim();
  const username = (process.env.SMS_INDIA_HUB_USERNAME || '').trim();
  const dltTemplateId = (process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || '').trim();

  if (!apiKey || !senderId) {
    throw new Error('SMS India HUB credentials are missing. Please check environment variables.');
  }

  const cleanMobile = normalizeMobileNumber(mobile);

  // Determine if passed string is a 4-digit OTP or a pre-built message
  const otp = /^\d{4}$/.test(otpOrMessage) ? otpOrMessage : null;
  const msgCandidates = otp ? getOtpMessageCandidates(otp) : [otpOrMessage];

  // Try candidate variations until one succeeds or all fail
  let lastError: Error | null = null;

  for (let i = 0; i < msgCandidates.length; i++) {
    const candidateMsg = msgCandidates[i];

    // Build params with ALL common alias parameter names for DLT Template ID & Sender ID
    // so whichever parameter key the SMS gateway parser expects, it receives it!
    const params: Record<string, string> = {
      user: username,
      password: apiKey,
      APIKey: apiKey,
      msisdn: cleanMobile,
      sid: senderId,
      sender: senderId,
      senderid: senderId,
      msg: candidateMsg,
      fl: '0',
      gwid: '2', // gwid=2 (Transactional route for OTPs)
    };

    if (dltTemplateId) {
      params.DLT_TE_ID = dltTemplateId;
      params.dlt_te_id = dltTemplateId;
      params.templateid = dltTemplateId;
      params.template_id = dltTemplateId;
    }

    console.log(`[SMS India HUB] Attempting Candidate #${i + 1}/${msgCandidates.length}:`, {
      msisdn: cleanMobile,
      sid: senderId,
      user: username,
      DLT_TE_ID: dltTemplateId,
      msg: candidateMsg,
    });

    try {
      const response = await axios.get<SmsIndiaHubResponse>(SMS_INDIA_HUB_API_URL, {
        params,
        timeout: API_TIMEOUT,
      });

      console.log(`[SMS India HUB] Candidate #${i + 1} Raw Response:`, JSON.stringify(response.data));

      handleSmsResponse(response.data);

      console.log(`✅ [SMS India HUB] Success with Candidate #${i + 1}: "${candidateMsg}"`);
      return; // Success!
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [SMS India HUB] Candidate #${i + 1} Failed: ${err.message}`);

      // If it's NOT a DLT template error (e.g. invalid credentials or network error), don't keep retrying variations
      if (!err.message?.includes('DLT template') && !err.message?.includes('006')) {
        throw err;
      }
    }
  }

  // Also try once without gwid parameter if all gwid=2 attempts failed
  if (dltTemplateId && msgCandidates.length > 0) {
    const fallbackMsg = msgCandidates[0];
    console.log('[SMS India HUB] Trying fallback attempt without gwid parameter...');
    try {
      const fallbackParams: Record<string, string> = {
        user: username,
        password: apiKey,
        APIKey: apiKey,
        msisdn: cleanMobile,
        sid: senderId,
        msg: fallbackMsg,
        DLT_TE_ID: dltTemplateId,
        templateid: dltTemplateId,
      };
      const response = await axios.get<SmsIndiaHubResponse>(SMS_INDIA_HUB_API_URL, {
        params: fallbackParams,
        timeout: API_TIMEOUT,
      });
      console.log('[SMS India HUB] Fallback (no gwid) Response:', JSON.stringify(response.data));
      handleSmsResponse(response.data);
      console.log(`✅ [SMS India HUB] Success without gwid param: "${fallbackMsg}"`);
      return;
    } catch (err: any) {
      console.warn(`⚠️ [SMS India HUB] Fallback without gwid failed: ${err.message}`);
    }
  }

  throw lastError || new Error('SMS India HUB: Failed to send SMS with all DLT template variations.');
}

/**
 * Save OTP to database
 */
async function saveOtpToDb(mobile: string, otp: string, userType: UserType): Promise<void> {
  // Normalize mobile number (remove any non-digits, ensure consistent format)
  const normalizedMobile = mobile.replace(/\D/g, '');

  await Otp.deleteMany({ mobile: normalizedMobile, userType });
  await Otp.create({
    mobile: normalizedMobile,
    otp: otp.trim(),
    userType,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
  });
}

/**
 * Verify OTP from database
 */
async function verifyOtpFromDb(mobile: string, otp: string, userType: UserType): Promise<boolean> {
  // Normalize mobile number (remove any non-digits, ensure consistent format)
  const normalizedMobile = mobile.replace(/\D/g, '');

  const record = await Otp.findOne({
    mobile: normalizedMobile,
    userType,
    otp: otp.trim()
  });

  if (!record) {
    console.log(`❌ OTP Verification Failed for ${mobile} (${userType}). No record found for OTP: ${otp.trim()}`);
    return false;
  }

  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    console.log(`❌ OTP Verification Failed for ${mobile} (${userType}). OTP ${otp.trim()} has expired.`);
    return false;
  }

  await Otp.deleteOne({ _id: record._id });
  console.log(`✅ OTP Verification Successful for ${mobile} (${userType})`);
  return true;
}


/**
 * Check if special bypass should be used
 */
function isSpecialBypass(mobile: string): boolean {
  const adminMobile = process.env.DEFAULT_ADMIN_MOBILE || '9111966732';
  return mobile === adminMobile || mobile === '9111966732' || mobile === '6268423925' || mobile === '916268423925';
}

/**
 * Check if mock mode should be used
 */
function isMockMode(): boolean {
  return process.env.USE_MOCK_OTP === 'true' || !SMS_INDIA_HUB_API_KEY || !SMS_INDIA_HUB_SENDER_ID;
}

/**
 * Check if developer bypass OTP
 */
function isDeveloperBypass(otp: string): boolean {
  const defaultOtp = process.env.DEFAULT_OTP || '1234';
  return (process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true') && (otp === defaultOtp || otp === '999999' || otp === '0000');
}


// ==========================================
// SMS OTP (Customer / Delivery)
// ==========================================

export async function sendSmsOtp(
  mobile: string,
  userType: 'Customer' | 'Delivery' = 'Delivery'
): Promise<OtpResponse> {
  try {
    const otp = generateOTP(4);

    // Special number bypass
    if (isSpecialBypass(mobile)) {
      const specialOtp = (mobile === '6268423925' || mobile === '916268423925') ? '9999' : (process.env.DEFAULT_OTP || '1234');
      await saveOtpToDb(mobile, specialOtp, userType);
      return {
        success: true,
        sessionId: 'DB_VERIFIED_' + mobile,
        message: 'OTP sent successfully',
      };
    }

    // Mock mode
    if (isMockMode()) {
      await saveOtpToDb(mobile, otp, userType);
      return {
        success: true,
        sessionId: 'MOCK_SESSION_' + mobile,
        message: 'OTP sent successfully',
      };
    }

    // Real mode - Send via SMS India HUB
    await saveOtpToDb(mobile, otp, userType);
    await sendSmsViaApi(mobile, otp);

    return {
      success: true,
      sessionId: 'DB_VERIFIED_' + mobile,
      message: 'OTP sent successfully',
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send OTP. Please try again.';
    console.error('SMS OTP Error (sendSmsOtp):', {
      error: errorMessage,
      mobile,
      userType,
    });
    throw new Error(errorMessage);
  }
}

export async function verifySmsOtp(
  sessionId: string,
  otpInput: string,
  mobile?: string,
  userType: 'Customer' | 'Delivery' = 'Delivery'
): Promise<boolean> {
  if (isDeveloperBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, '');

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error('OTP verification failed - invalid OTP format:', {
      otpInput,
      normalizedOtp,
      length: normalizedOtp.length
    });
    return false;
  }

  let targetMobile = mobile;
  if (!targetMobile && sessionId) {
    if (sessionId.startsWith('DB_VERIFIED_')) {
      targetMobile = sessionId.replace('DB_VERIFIED_', '');
    } else if (sessionId.startsWith('MOCK_SESSION_')) {
      targetMobile = sessionId.replace('MOCK_SESSION_', '');
    }
  }

  if (!targetMobile) {
    console.error('OTP verification failed - no mobile number:', {
      sessionId,
      mobile,
      userType
    });
    return false;
  }

  // Normalize mobile number
  const normalizedMobile = targetMobile.replace(/\D/g, '');

  if (normalizedMobile.length !== 10) {
    console.error('OTP verification failed - invalid mobile format:', {
      original: targetMobile,
      normalized: normalizedMobile,
      length: normalizedMobile.length
    });
    return false;
  }

  return verifyOtpFromDb(normalizedMobile, normalizedOtp, userType);
}

// ==========================================
// SMS OTP (Seller / Admin)
// ==========================================

export async function sendOTP(
  mobile: string,
  userType: 'Seller' | 'Admin' | 'Customer' | 'Delivery',
  _isLogin: boolean = true
): Promise<OtpResponse> {
  try {
    const otp = generateOTP(4);

    // Special number bypass
    if (isSpecialBypass(mobile)) {
      const specialOtp = (mobile === '6268423925' || mobile === '916268423925') ? '9999' : (process.env.DEFAULT_OTP || '1234');
      await saveOtpToDb(mobile, specialOtp, userType);
      return {
        success: true,
        message: 'OTP sent successfully',
      };
    }

    // Mock mode
    if (isMockMode()) {
      await saveOtpToDb(mobile, otp, userType);
      return {
        success: true,
        message: 'OTP sent successfully',
      };
    }

    // Real mode - Send via SMS India HUB
    await saveOtpToDb(mobile, otp, userType);
    await sendSmsViaApi(mobile, otp);

    return {
      success: true,
      message: process.env.NODE_ENV !== 'production' ? `OTP sent successfully: ${otp}` : 'OTP sent successfully',
    };

  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send OTP. Please try again.';
    console.error('SMS OTP Error (sendOTP):', {
      error: errorMessage,
      mobile,
      userType,
    });
    throw new Error(errorMessage);
  }
}

export async function verifyOTP(
  mobile: string,
  otpInput: string,
  userType: 'Seller' | 'Admin' | 'Customer' | 'Delivery'
): Promise<boolean> {
  if (isDeveloperBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, '');

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error('OTP verification failed - invalid OTP format:', {
      otpInput,
      normalizedOtp,
      length: normalizedOtp.length
    });
    return false;
  }

  // Normalize mobile number
  const normalizedMobile = mobile.replace(/\D/g, '');

  if (normalizedMobile.length !== 10) {
    console.error('OTP verification failed - invalid mobile format:', {
      original: mobile,
      normalized: normalizedMobile,
      length: normalizedMobile.length
    });
    return false;
  }

  return verifyOtpFromDb(normalizedMobile, normalizedOtp, userType);
}
