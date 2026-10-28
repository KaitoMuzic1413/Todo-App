import crypto from 'crypto';
import mongoose from 'mongoose';
import InviteCode from '../models/InviteCode.js';
import User from '../models/User.js';
import {
  PREMIUM_PLAN_DAYS,
  getPremiumUntil,
  getQuotaSnapshot,
  isPremiumActive,
} from '../utils/premium.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const normalizeCode = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');
const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const generateCode = () => {
  const block = () => Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]).join('');
  return `KAITO-${block()}-${block()}`;
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.userId).select('isAdmin');
    if (!user) return res.status(401).json({ message: 'Authentication required.' });
    if (!user.isAdmin) return res.status(403).json({ message: 'Administrator access is required.' });
    req.adminUser = user;
    return next();
  } catch (error) {
    console.error('Premium admin check error:', error);
    return res.status(500).json({ message: 'Unable to verify administrator access.' });
  }
};

export const getMyPremium = async (req, res) => {
  try {
    const snapshot = await getQuotaSnapshot(req.user.userId);
    if (!snapshot) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error('Get premium status error:', error);
    return res.status(500).json({ message: 'Unable to load premium status.' });
  }
};

export const createInviteCode = async (req, res, next) => {
  try {
    const planDays = req.body?.planDays === undefined ? PREMIUM_PLAN_DAYS : Number(req.body.planDays);
    const maxUses = req.body?.maxUses === undefined ? 1 : Number(req.body.maxUses);
    const requestedCode = normalizeCode(req.body?.code);

    if (!Number.isInteger(planDays) || planDays < 1 || planDays > 3650) {
      return res.status(400).json({ message: 'Plan duration must be between 1 and 3650 days.' });
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) {
      return res.status(400).json({ message: 'Maximum uses must be between 1 and 100000.' });
    }
    if (requestedCode && !/^[A-Z0-9-]{4,40}$/.test(requestedCode)) {
      return res.status(400).json({ message: 'Invite code must be 4-40 letters, numbers, or hyphens.' });
    }

    let expiresAt = null;
    if (req.body?.expiresAt) {
      expiresAt = new Date(req.body.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
        return res.status(400).json({ message: 'Invite expiry must be a future date.' });
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const invite = await InviteCode.create({
          code: requestedCode || generateCode(),
          createdBy: req.user.userId,
          planDays,
          maxUses,
          expiresAt,
        });
        return res.status(201).json({ invite });
      } catch (error) {
        if (error.code !== 11000) throw error;
        if (requestedCode) return res.status(409).json({ message: 'That invite code already exists.' });
      }
    }

    return res.status(500).json({ message: 'Could not generate a unique invite code. Please try again.' });
  } catch (error) {
    console.error('Create invite code error:', error);
    return next(error);
  }
};

export const redeemInviteCode = async (req, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ message: 'Invite code is required.' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const now = new Date();
    const invite = await InviteCode.findOneAndUpdate(
      {
        code,
        isActive: true,
        $expr: { $lt: ['$usedCount', '$maxUses'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        'usedBy.userId': { $ne: user._id },
      },
      {
        $inc: { usedCount: 1 },
        $push: { usedBy: { userId: user._id, redeemedAt: now } },
      },
      { new: true }
    );

    if (!invite || invite.usedCount > invite.maxUses) {
      if (invite) {
        await InviteCode.updateOne(
          { _id: invite._id },
          { $inc: { usedCount: -1 }, $pull: { usedBy: { userId: user._id } } }
        );
      }
      return res.status(400).json({ message: 'This invite code is invalid, expired, fully used, or already redeemed.' });
    }

    const currentUntil = isPremiumActive(user) ? getPremiumUntil(user) : null;
    const startsAt = currentUntil && currentUntil > now ? currentUntil : now;
    const expiresAt = new Date(startsAt.getTime() + invite.planDays * DAY_IN_MS);

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'premium.isPremium': true,
          'premium.plan': 'premium',
          'premium.activatedAt': user.premium?.activatedAt || now,
          'premium.expiresAt': expiresAt,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      await InviteCode.updateOne(
        { _id: invite._id },
        { $inc: { usedCount: -1 }, $pull: { usedBy: { userId: user._id } } }
      );
      return res.status(404).json({ message: 'User not found.' });
    }

    const snapshot = await getQuotaSnapshot(user._id);
    return res.status(200).json({
      message: 'Premium activated successfully.',
      premiumUntil: expiresAt,
      premium: snapshot,
    });
  } catch (error) {
    console.error('Redeem invite code error:', error);
    return res.status(500).json({ message: 'Unable to redeem the invite code.' });
  }
};

export const getInviteCodesForAdmin = async (req, res) => {
  try {
    const invites = await InviteCode.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('createdBy', 'email name')
      .lean();
    return res.status(200).json({ invites });
  } catch (error) {
    console.error('List invite codes error:', error);
    return res.status(500).json({ message: 'Unable to load invite codes.' });
  }
};

export const deleteInviteCode = async (req, res) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'A valid invite code id is required.' });
    }
    const deleted = await InviteCode.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Invite code not found.' });
    return res.status(200).json({ message: 'Invite code deleted.' });
  } catch (error) {
    console.error('Delete invite code error:', error);
    return res.status(500).json({ message: 'Unable to delete the invite code.' });
  }
};

export const requirePremiumAdmin = requireAdmin;
