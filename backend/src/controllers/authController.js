import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import { createToken } from '../middlewares/authMiddleware.js';
import {
  createClientUser,
  createOtpCode,
  createGoogleUser,
  findLatestActiveOtpCode,
  findOtpCodeById,
  findUserByEmail,
  findUserByContact,
  findUserByGoogleId,
  findUserById,
  findUserForLogin,
  markOtpCodeUsedById,
  markOtpCodeVerifiedById,
  markUserEmailVerifiedById,
  markUserPhoneVerifiedById,
  linkGoogleIdToUser,
  sanitizeUser,
  updateUserPasswordHashById,
} from '../models/userModel.js';
import { sendOtpEmail } from '../services/emailService.js';
import { sendOtpSms } from '../services/smsService.js';
import { getContactChannel, isValidEmail, normalizeEmail, normalizePhoneNumber } from '../services/contactService.js';
import { buildOtpExpiry, generateAlphaNumericOtp, generateNumericOtp, isOtpExpired } from '../services/otpService.js';
import { respondToAuthFailure } from '../utils/authFailure.js';
import { getJwtSecret } from '../utils/jwtSecret.js';

const OTP_EXPIRY_MINUTES = 10;
const JWT_SECRET = getJwtSecret();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client();

function passwordIsStrong(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value || ''));
}

function normalizeOtp(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function createPasswordResetToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function verifyPasswordResetToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function issueOtpForUser({ user, purpose, channel = user.phone && !user.email ? 'phone' : 'email' }) {
  const recipient = channel === 'phone' ? user.phone : user.email;
  const otpCode = channel === 'phone' ? generateNumericOtp() : generateAlphaNumericOtp();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = buildOtpExpiry(OTP_EXPIRY_MINUTES);

  await createOtpCode({
    userId: user.id,
    recipient,
    channel,
    purpose,
    otpHash,
    expiresAt,
  });

  const deliveryResult = channel === 'phone'
    ? await sendOtpSms({
        to: recipient,
        purpose,
        otp: otpCode,
        expiresMinutes: OTP_EXPIRY_MINUTES,
      })
    : await sendOtpEmail({
        to: recipient,
        purpose,
        otp: otpCode,
        expiresMinutes: OTP_EXPIRY_MINUTES,
      });

  return {
    channel,
    sent: !!deliveryResult?.sent,
    deliveryError: deliveryResult?.reason || '',
  };
}

function otpDeliveryResponse(otpResult, message) {
  if (otpResult.sent) {
    return { status: 200, body: { message, channel: otpResult.channel } };
  }

  return {
    status: 503,
    body: {
      error: otpResult.channel === 'email' && otpResult.deliveryError
        ? otpResult.deliveryError
        : `The verification code could not be sent by ${otpResult.channel === 'phone' ? 'SMS' : 'email'}. Please try again shortly.`,
      code: otpResult.channel === 'phone' ? 'SMS_DELIVERY_FAILED' : 'EMAIL_DELIVERY_FAILED',
      channel: otpResult.channel,
      deliveryError: otpResult.deliveryError,
    },
  };
}

export async function register(req, res) {
  const { fullName, password, staffReason } = req.body;
  const email = String(req.body.email || '').trim();
  if (String(req.body.phone || '').trim()) {
    return res.status(400).json({ error: 'Public registration is email only.' });
  }

  if (!fullName || !email || !password || !String(staffReason || '').trim()) {
    return res.status(400).json({
      error: 'fullName, email, password, and staffReason are required.',
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!passwordIsStrong(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await createClientUser({
      fullName,
      email: normalizeEmail(email),
      phone: null,
      passwordHash,
      staffReason,
    });
    const contact = normalizeEmail(email);
    const createdUser = await findUserById(userId);

    if (!createdUser) {
      return res.status(500).json({ error: 'Could not register user.' });
    }

    const otpResult = await issueOtpForUser({ user: createdUser, purpose: 'verify_email', channel: 'email' });
    const delivery = otpDeliveryResponse(
      otpResult,
      'Registration successful. Verify your email with the code sent to your inbox.'
    );

    return res.status(delivery.status === 200 ? 201 : delivery.status).json({
      ...delivery.body,
      role: 'client',
      status: 'pending_client',
      email: createdUser.email || '',
      phone: createdUser.phone || '',
      contact,
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email address already exists.' });
    }

    return respondToAuthFailure(res, error, 'Registration', 'Could not register user.');
  }
}

export async function login(req, res) {
  const identifier = String(req.body.identifier || req.body.email || '').trim();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'email or phone number and password are required.' });
  }

  try {
    const channel = getContactChannel(identifier);
    const contact = channel === 'phone'
      ? normalizePhoneNumber(identifier)
      : normalizeEmail(identifier);
    if (!contact || (channel === 'email' && !isValidEmail(contact))) {
      return res.status(400).json({ error: channel === 'phone' ? 'Enter a valid phone number in international format.' : 'Enter a valid email address.' });
    }

    const user = await findUserForLogin(contact);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.is_archived) {
      return res.status(403).json({
        error: 'Your account has been removed. Please contact the administrator.',
        code: 'ACCOUNT_ARCHIVED',
      });
    }

    const isVerified = channel === 'phone' ? user.is_phone_verified : user.is_email_verified;
    if (!isVerified) {
      return res.status(403).json({
        error: `${channel === 'phone' ? 'Phone number' : 'Email'} is not verified. Please verify it first.`,
        code: channel === 'phone' ? 'PHONE_NOT_VERIFIED' : 'EMAIL_NOT_VERIFIED',
        email: user.email,
        phone: user.phone,
        contact,
        channel,
      });
    }

    return res.status(200).json({
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Login', 'Could not log in.');
  }
}

export async function googleLogin(req, res) {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google login is not configured on the server.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Google account email could not be verified.' });
    }

    let user = await findUserByGoogleId(payload.sub);
    if (!user) {
      user = await findUserByEmail(payload.email);
      if (user) {
        await linkGoogleIdToUser(user.id, payload.sub);
      } else {
        const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
        const userId = await createGoogleUser(
          payload.name || payload.email.split('@')[0],
          payload.email,
          passwordHash,
          payload.sub
        );
        user = await findUserById(userId);
      }
    }

    if (!user) {
      return res.status(500).json({ error: 'Could not create the Google account.' });
    }

    if (user.is_archived) {
      return res.status(403).json({
        error: 'Your account has been removed. Please contact the administrator.',
        code: 'ACCOUNT_ARCHIVED',
      });
    }

    return res.status(200).json({
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch {
    return res.status(401).json({ error: 'Google authentication failed.' });
  }
}

export async function me(req, res) {
  try {
    const user = await findUserById(req.auth.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Fetching user profile', 'Could not fetch user profile.');
  }
}

export async function resendVerifyOtp(req, res) {
  const contact = String(req.body.contact || req.body.email || req.body.phone || '').trim();
  const channel = req.body.channel || getContactChannel(contact);

  if (!contact) {
    return res.status(400).json({ error: 'email or phone number is required.' });
  }

  try {
    const user = await findUserByContact(contact, channel);
    if (!user) {
      return res.status(404).json({ error: 'No account was found for this contact.' });
    }

    const isVerified = channel === 'phone' ? user.is_phone_verified : user.is_email_verified;
    if (isVerified) {
      return res.status(200).json({ message: `${channel === 'phone' ? 'Phone number' : 'Email'} is already verified.` });
    }

    const otpResult = await issueOtpForUser({ user, purpose: 'verify_email', channel });
    const delivery = otpDeliveryResponse(
      otpResult,
      `Verification code sent by ${channel === 'phone' ? 'SMS' : 'email'}.`
    );
    return res.status(delivery.status).json(delivery.body);
  } catch (error) {
    return respondToAuthFailure(res, error, 'Sending verification code', 'Could not send verification code.');
  }
}

export async function verifyEmailOtp(req, res) {
  const contact = String(req.body.contact || req.body.email || req.body.phone || '').trim();
  const channel = req.body.channel || getContactChannel(contact);
  const { otp } = req.body;

  if (!contact || !otp) {
    return res.status(400).json({ error: 'contact and otp are required.' });
  }

  try {
    const user = await findUserByContact(contact, channel);
    if (!user) {
      return res.status(404).json({ error: 'No account was found for this contact.' });
    }

    const otpRecord = await findLatestActiveOtpCode(contact, 'verify_email', channel);
    if (!otpRecord) {
      return res.status(400).json({ error: 'No active verification OTP found. Please resend OTP.' });
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      await markOtpCodeUsedById(otpRecord.id);
      return res.status(400).json({ error: 'OTP has expired. Please resend OTP.' });
    }

    const otpMatches = await bcrypt.compare(normalizeOtp(otp), otpRecord.otp_hash);
    if (!otpMatches) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    await markOtpCodeVerifiedById(otpRecord.id);
    await markOtpCodeUsedById(otpRecord.id);
    if (channel === 'phone') {
      await markUserPhoneVerifiedById(user.id);
    } else {
      await markUserEmailVerifiedById(user.id);
    }

    const verifiedUser = await findUserById(user.id);
    return res.status(200).json({
      message: `${channel === 'phone' ? 'Phone number' : 'Email'} verified successfully.`,
      token: createToken(verifiedUser),
      user: sanitizeUser(verifiedUser),
    });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Verifying OTP', 'Could not verify OTP.');
  }
}

export async function forgotPasswordRequestOtp(req, res) {
  const contact = String(req.body.contact || req.body.email || req.body.phone || '').trim();
  const channel = req.body.channel || getContactChannel(contact);

  if (!contact) {
    return res.status(400).json({ error: 'email or phone number is required.' });
  }

  try {
    const user = await findUserByContact(contact, channel);

    if (user) {
      const otpResult = await issueOtpForUser({ user, purpose: 'reset_password', channel });
      const delivery = otpDeliveryResponse(otpResult, 'If your account exists, a reset code has been sent.');
      if (delivery.status !== 200 || !otpResult.sent) {
        return res.status(delivery.status).json(delivery.body);
      }
    }

    return res.status(200).json({ message: 'If your account exists, a reset code has been sent.' });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Requesting password reset', 'Could not process forgot password request.');
  }
}

export async function forgotPasswordVerifyOtp(req, res) {
  const contact = String(req.body.contact || req.body.email || req.body.phone || '').trim();
  const channel = req.body.channel || getContactChannel(contact);
  const { otp } = req.body;

  if (!contact || !otp) {
    return res.status(400).json({ error: 'contact and otp are required.' });
  }

  try {
    const otpRecord = await findLatestActiveOtpCode(contact, 'reset_password', channel);
    if (!otpRecord) {
      return res.status(400).json({ error: 'No active reset OTP found. Please request a new OTP.' });
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      await markOtpCodeUsedById(otpRecord.id);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    const otpMatches = await bcrypt.compare(normalizeOtp(otp), otpRecord.otp_hash);
    if (!otpMatches) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    await markOtpCodeVerifiedById(otpRecord.id);
    const resetToken = createPasswordResetToken({
      otpId: otpRecord.id,
      recipient: otpRecord.recipient,
      channel: otpRecord.channel,
      purpose: 'reset_password',
    });

    return res.status(200).json({
      message: 'OTP verified successfully.',
      resetToken,
    });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Verifying password reset OTP', 'Could not verify reset OTP.');
  }
}

export async function forgotPasswordReset(req, res) {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'resetToken, newPassword, and confirmPassword are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password do not match.' });
  }

  if (!passwordIsStrong(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
  }

  try {
    const payload = verifyPasswordResetToken(resetToken);
    if (!payload || payload.purpose !== 'reset_password') {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    const otpRecord = await findOtpCodeById(payload.otpId);
    if (
      !otpRecord ||
      otpRecord.recipient !== payload.recipient ||
      otpRecord.channel !== payload.channel ||
      otpRecord.purpose !== 'reset_password'
    ) {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    if (otpRecord.used_at || !otpRecord.verified_at || isOtpExpired(otpRecord.expires_at)) {
      return res.status(400).json({ error: 'Reset token is expired or already used.' });
    }

    const user = await findUserById(otpRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHashById(user.id, passwordHash);
    await markOtpCodeUsedById(otpRecord.id);

    return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return respondToAuthFailure(res, error, 'Resetting password', 'Invalid or expired reset token.', 400);
  }
}
