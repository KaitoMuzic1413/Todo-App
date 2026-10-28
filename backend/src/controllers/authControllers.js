import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { sendEmail } from '../utils/email.js';
import { deliverNewAccountNotifications } from '../utils/onboardingNotifications.js';
import { env } from '../config/env.js';
import {
  createAccessToken,
  createRefreshTokenValue,
  decryptRefreshToken,
  encryptRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
} from '../utils/authTokens.js';
import {
  clearRefreshTokenCookie,
  readCookie,
  REFRESH_TOKEN_COOKIE,
  setRefreshTokenCookie,
} from '../utils/cookies.js';

const PASSWORD_RESET_MESSAGE = 'If an account exists for that email, a reset code will be sent shortly.';
const EMAIL_VERIFICATION_MESSAGE = 'If this account needs verification, a new email is on its way.';
const REFRESH_TOKEN_GRACE_MS = 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_COOLDOWN_MS = 60 * 1000;
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asTrimmedString = (value) => (typeof value === 'string' ? value.trim() : null);
const isConfiguredAdmin = (email) => {
  const adminEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).toLowerCase().trim() : '';
  return Boolean(adminEmail && adminEmail === email);
};

const hasValidEmailShape = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const publicUser = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name || '',
  avatarUrl: user.avatarUrl || '',
  isAdmin: Boolean(user.isAdmin),
  emailVerified: user.emailVerified !== false,
});

const getRequestUserAgent = (req) => String(req.get?.('user-agent') || '').slice(0, 512);

const createEmailVerification = async (user) => {
  const token = crypto.randomBytes(32).toString('base64url');
  user.emailVerificationTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  user.emailVerificationSentAt = new Date();
  await user.save();

  const link = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Kaito Todo email',
    text: `Confirm your Kaito Todo email address by opening this link: ${link}`,
    categories: ['email-verification'],
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Verify your email</h2>
        <p>Confirm your Kaito Todo email address to finish setting up your account.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:16px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;">Verify email</a></p>
        <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
};

const issueSession = async ({ user, req, res }) => {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshTokenValue();
  const expiresAt = getRefreshTokenExpiry();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    sessionVersion: user.sessionVersion || 0,
    expiresAt,
    createdByIp: req.ip || '',
    userAgent: getRequestUserAgent(req),
  });

  setRefreshTokenCookie(res, refreshToken, expiresAt.getTime() - Date.now());
  return accessToken;
};

export const register = async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    const password = typeof body.password === 'string' ? body.password : null;
    const name = body.name === undefined ? '' : asTrimmedString(body.name);

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (!hasValidEmailShape(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (body.name !== undefined && (name === null || name.length > 80)) {
      return res.status(400).json({ message: 'Name must be 80 characters or fewer.' });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }

    const trimmedEmail = email.toLowerCase();
    let user = await User.findOne({ email: trimmedEmail });
    const isFirstAccountSetup = !user || !user.password;

    if (user && user.password) {
      return res.status(409).json({
        exists: true,
        message: 'Account already exists. Please sign in instead.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationRequired = env.emailVerificationRequired;

    if (user) {
      user.password = hashedPassword;
      if (name) user.name = name;
      user.lastActiveAt = new Date();
      user.inactiveDeletionNoticeSentAt = null;
      if (verificationRequired) {
        user.emailVerified = false;
        await createEmailVerification(user);
      } else {
        user.emailVerified = true;
        await user.save();
      }
    } else {
      user = await User.create({
        email: trimmedEmail,
        password: hashedPassword,
        isAdmin: isConfiguredAdmin(trimmedEmail),
        emailVerified: !verificationRequired,
        ...(name ? { name } : {}),
      });
      if (verificationRequired) await createEmailVerification(user);
    }

    if (isConfiguredAdmin(trimmedEmail) && !user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }

    if (isFirstAccountSetup) await deliverNewAccountNotifications(user);

    return res.status(201).json({
      message: verificationRequired
        ? 'Account created. Check your email to verify your address before signing in.'
        : 'Account created successfully.',
      verificationRequired,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

export const login = async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    const password = typeof body.password === 'string' ? body.password : null;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (!hasValidEmailShape(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const trimmedEmail = email.toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });
    const invalidCredentials = () => res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });

    if (!user || !user.password) return invalidCredentials();

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) return invalidCredentials();

    if (env.emailVerificationRequired && user.emailVerified === false) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before signing in.',
      });
    }

    user.lastActiveAt = new Date();
    user.inactiveDeletionNoticeSentAt = null;
    if (isConfiguredAdmin(trimmedEmail)) user.isAdmin = true;
    await user.save();

    const token = await issueSession({ user, req, res });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

const getUserWithValidResetOtp = async (email, otp) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires || user.resetPasswordOtpExpires <= new Date() || user.resetPasswordOtpAttempts >= 5) {
    return null;
  }

  const submittedHash = crypto.createHmac('sha256', env.otpSecret)
    .update(`${user._id}:${otp}`)
    .digest('hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  const storedBuffer = Buffer.from(user.resetPasswordOtpHash, 'hex');
  if (submittedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(submittedBuffer, storedBuffer)) {
    return user;
  }

  const attemptsReachedLimit = user.resetPasswordOtpAttempts + 1 >= 5;
  await User.updateOne(
    {
      _id: user._id,
      resetPasswordOtpHash: user.resetPasswordOtpHash,
      resetPasswordOtpExpires: { $gt: new Date() },
      resetPasswordOtpAttempts: { $lt: 5 },
    },
    {
      $inc: { resetPasswordOtpAttempts: 1 },
      ...(attemptsReachedLimit ? { $set: { resetPasswordOtpHash: null, resetPasswordOtpExpires: null } } : {}),
    }
  );
  return null;
};

export const verifyResetOtp = async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    const otp = asTrimmedString(body.otp);
    if (!email || !otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Email and a 6-digit verification code are required.' });
    }

    const user = await getUserWithValidResetOtp(email, otp);
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification code.' });
    return res.status(200).json({ message: 'Verification code confirmed.' });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return res.status(500).json({ message: 'Server error while verifying the code.' });
  }
};

export const forgotPassword = async (req, res) => {
  let user = null;
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    if (!email || !hasValidEmailShape(email)) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const trimmedEmail = email.toLowerCase();
    user = await User.findOne({ email: trimmedEmail });

    if (!user) return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    const requestedAt = user.resetPasswordOtpRequestedAt?.getTime();
    if (requestedAt && Date.now() - requestedAt < 60 * 1000) {
      return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    user.resetPasswordOtpHash = crypto.createHmac('sha256', env.otpSecret)
      .update(`${user._id}:${otp}`)
      .digest('hex');
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordOtpRequestedAt = new Date();
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      text: `Your Kaito Todo password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      categories: ['password-reset'],
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Kaito Todo password reset</h2>
          <p>Use this verification code to reset your password. It expires in 10 minutes.</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
  } catch (error) {
    console.error('Password reset email delivery failed:', error);
    if (user?.resetPasswordOtpHash) {
      try {
        await User.updateOne(
          { _id: user._id, resetPasswordOtpHash: user.resetPasswordOtpHash },
          {
            $unset: { resetPasswordOtpHash: 1, resetPasswordOtpExpires: 1 },
            $set: { resetPasswordOtpAttempts: 0 },
          }
        );
      } catch (cleanupError) {
        console.error('Could not clear the unsent password reset code:', cleanupError);
      }
    }
    return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    const otp = asTrimmedString(body.otp);
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : null;
    const name = body.name === undefined ? undefined : asTrimmedString(body.name);

    if (!email || !otp || !newPassword || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required.' });
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }
    if (name !== undefined && (!name || name.length > 80)) {
      return res.status(400).json({ message: 'Name must contain 1 to 80 characters.' });
    }

    const invalidCodeMessage = 'Invalid or expired verification code.';
    const user = await getUserWithValidResetOtp(email, otp);
    if (!user) return res.status(400).json({ message: invalidCodeMessage });

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetPasswordOtpHash: user.resetPasswordOtpHash,
        resetPasswordOtpExpires: { $gt: new Date() },
        resetPasswordOtpAttempts: { $lt: 5 },
      },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 10),
          ...(name !== undefined ? { name } : {}),
          sessionVersion: (user.sessionVersion || 0) + 1,
          lastActiveAt: new Date(),
          inactiveDeletionNoticeSentAt: null,
          resetPasswordOtpHash: null,
          resetPasswordOtpExpires: null,
          resetPasswordOtpAttempts: 0,
          resetPasswordOtpRequestedAt: null,
        },
      },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ message: invalidCodeMessage });
    }

    await RefreshToken.deleteMany({ userId: user._id });
    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error while resetting password.' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = readCookie(req.headers?.cookie, REFRESH_TOKEN_COOKIE);
    if (refreshToken) {
      const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(refreshToken) });
      if (record) {
        await RefreshToken.deleteMany({ userId: record.userId });
        await User.updateOne({ _id: record.userId }, { $inc: { sessionVersion: 1 } });
      }
    }

    clearRefreshTokenCookie(res);
    return res.status(200).json({ message: 'Signed out.' });
  } catch (error) {
    console.error('Logout error:', error);
    clearRefreshTokenCookie(res);
    return res.status(200).json({ message: 'Signed out.' });
  }
};

export const refreshSession = async (req, res) => {
  const fail = () => {
    clearRefreshTokenCookie(res);
    return res.status(401).json({
      code: 'REFRESH_TOKEN_INVALID',
      message: 'Your session has expired. Please sign in again.',
    });
  };

  try {
    const refreshToken = readCookie(req.headers?.cookie, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) return fail();

    const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(refreshToken) });
    if (!record) return fail();

    if (!record.expiresAt || record.expiresAt.getTime() <= Date.now()) {
      await record.deleteOne?.();
      return fail();
    }

    const user = await User.findById(record.userId).select('email name avatarUrl isAdmin sessionVersion');
    if (!user) {
      await record.deleteOne?.();
      return fail();
    }

    if ((record.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      await RefreshToken.deleteMany({ userId: user._id });
      return fail();
    }

    const now = new Date();
    const candidateToken = createRefreshTokenValue();
    const candidateHash = hashRefreshToken(candidateToken);
    const candidateExpiresAt = getRefreshTokenExpiry();

    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: record._id, rotatedAt: null },
      {
        $set: {
          rotatedAt: now,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_GRACE_MS),
          replacementTokenEncrypted: encryptRefreshToken(candidateToken),
          replacementTokenExpiresAt: candidateExpiresAt,
        },
      },
      { new: true }
    );

    let nextToken = candidateToken;
    let nextExpiresAt = candidateExpiresAt;

    if (!claimed) {
      const rotated = await RefreshToken.findById(record._id);
      if (!rotated?.replacementTokenEncrypted) return fail();
      nextToken = decryptRefreshToken(rotated.replacementTokenEncrypted);
      nextExpiresAt = rotated.replacementTokenExpiresAt || candidateExpiresAt;
    }

    const nextHash = hashRefreshToken(nextToken);
    await RefreshToken.updateOne(
      { tokenHash: nextHash },
      {
        $setOnInsert: {
          userId: user._id,
          tokenHash: nextHash,
          sessionVersion: user.sessionVersion || 0,
          expiresAt: nextExpiresAt,
          createdByIp: req.ip || '',
          userAgent: getRequestUserAgent(req),
        },
      },
      { upsert: true }
    );

    setRefreshTokenCookie(res, nextToken, Math.max(0, nextExpiresAt.getTime() - Date.now()));

    return res.status(200).json({
      token: createAccessToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    return fail();
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const token = asTrimmedString(req.query?.token || req.body?.token);
    const email = asTrimmedString(req.query?.email || req.body?.email);
    if (!token || !email) {
      return res.status(400).json({ message: 'A verification token and email are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    user.emailVerificationSentAt = null;
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ message: 'Server error while verifying your email.' });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ message: 'A JSON request body is required.' });
    }

    const email = asTrimmedString(body.email);
    if (!email || !hasValidEmailShape(email)) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.emailVerified === false) {
      const sentAt = user.emailVerificationSentAt?.getTime();
      if (!sentAt || Date.now() - sentAt >= EMAIL_VERIFICATION_COOLDOWN_MS) {
        try {
          await createEmailVerification(user);
        } catch (error) {
          console.error('Could not send verification email:', error);
        }
      }
    }

    return res.status(200).json({ message: EMAIL_VERIFICATION_MESSAGE });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(200).json({ message: EMAIL_VERIFICATION_MESSAGE });
  }
};
