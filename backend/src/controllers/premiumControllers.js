import InviteCode from "../models/InviteCode.js";
import User from "../models/User.js";

export const createInviteCode = async (req, res) => {
  try {
    const { userId, code, expiresInDays } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const creator = await User.findById(userId);
    if (!creator || !creator.isAdmin) return res.status(403).json({ message: "Not authorized" });

    if (!code || typeof code !== 'string') return res.status(400).json({ message: 'code is required' });

    const existing = await InviteCode.findOne({ code });
    if (existing) return res.status(409).json({ message: 'Code already exists' });

    const now = new Date();
    const expiresAt = expiresInDays ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const invite = await InviteCode.create({ code, createdBy: creator._id, expiresAt });
    return res.status(201).json({ invite });
  } catch (error) {
    console.error('Error createInviteCode', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const redeemInviteCode = async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ message: 'userId and code are required' });

    const invite = await InviteCode.findOne({ code, active: true });
    if (!invite) return res.status(404).json({ message: 'Invite code not found' });

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(410).json({ message: 'Invite code expired' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // grant unlimited quota for 30 days
    const now = new Date();
    user.premium = user.premium || {};
    user.premium.unlimitedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    // record redemption
    invite.redeemedBy = invite.redeemedBy || [];
    if (!invite.redeemedBy.find((id) => String(id) === String(user._id))) {
      invite.redeemedBy.push(user._id);
      await invite.save();
    }

    return res.status(200).json({ message: 'Invite redeemed', premium: user.premium });
  } catch (error) {
    console.error('Error redeemInviteCode', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getInviteCodesForAdmin = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) return res.status(403).json({ message: 'Not authorized' });

    const invites = await InviteCode.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ invites });
  } catch (error) {
    console.error('Error getInviteCodesForAdmin', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
