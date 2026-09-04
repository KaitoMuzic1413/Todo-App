import mongoose from 'mongoose';
import Attachment from '../models/Attachment.js';
import Task from '../models/Task.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain|text\/markdown)$/;

const getOwnerId = (req) => req.user?.userId;

const getBucket = () => {
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });
};

export const deleteAttachmentRecords = async ({ taskId, ownerId }) => {
  const attachments = await Attachment.find({ taskId, ownerId }).select('fileId');

  if (mongoose.connection.readyState === 1 && attachments.length > 0) {
    const bucket = getBucket();
    await Promise.allSettled(attachments.map(({ fileId }) => bucket.delete(fileId)));
  }

  const result = await Attachment.deleteMany({ taskId, ownerId });
  return result.deletedCount || 0;
};

export const uploadAttachment = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const { taskId = null } = req.body;
    const file = req.file;

    if (!ownerId || !file) {
      return res.status(400).json({ message: 'A file is required.' });
    }

    if (taskId && !mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    if (taskId) {
      const task = await Task.exists({ _id: taskId, userId: ownerId, isDeleted: false });
      if (!task) return res.status(404).json({ message: 'Task not found.' });
    }

    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: 'Files must be smaller than 10 MB.' });
    }
    if (!ALLOWED_TYPES.test(file.mimetype)) {
      return res.status(400).json({ message: 'This file type is not supported.' });
    }

    const fileId = new mongoose.Types.ObjectId();
    const bucket = getBucket();
    await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStreamWithId(fileId, file.originalname, {
        metadata: { ownerId: String(ownerId), mimeType: file.mimetype },
        contentType: file.mimetype,
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(file.buffer);
    });

    const attachment = await Attachment.create({
      ownerId,
      taskId,
      fileId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    return res.status(201).json({ attachment });
  } catch (error) {
    console.error('Create upload URL error:', error);
    return res.status(500).json({ message: error.message || 'Unable to prepare file upload.' });
  }
};

export const listAttachments = async (req, res) => {
  try {
    const attachments = await Attachment.find({ ownerId: getOwnerId(req), isDeleted: false }).sort({ createdAt: -1 });
    return res.status(200).json(attachments);
  } catch (error) {
    console.error('List attachments error:', error);
    return res.status(500).json({ message: 'Unable to load file archive.' });
  }
};

export const listTrashAttachments = async (req, res) => {
  try {
    const attachments = await Attachment.find({ ownerId: getOwnerId(req), isDeleted: true })
      .sort({ deletedAt: -1 });
    return res.status(200).json(attachments);
  } catch (error) {
    console.error('List deleted attachments error:', error);
    return res.status(500).json({ message: 'Unable to load deleted files.' });
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      ownerId: getOwnerId(req),
      isDeleted: false,
    });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    attachment.isDeleted = true;
    attachment.deletedAt = new Date();
    await attachment.save();
    return res.status(200).json({ message: 'Attachment moved to trash.' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return res.status(500).json({ message: 'Unable to delete attachment.' });
  }
};

export const restoreAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      ownerId: getOwnerId(req),
      isDeleted: true,
    });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    if (attachment.taskId) {
      const task = await Task.exists({ _id: attachment.taskId, userId: getOwnerId(req), isDeleted: false });
      if (!task) return res.status(409).json({ message: 'Restore the parent task first.' });
    }

    attachment.isDeleted = false;
    attachment.deletedAt = null;
    await attachment.save();
    return res.status(200).json({ message: 'Attachment restored.' });
  } catch (error) {
    console.error('Restore attachment error:', error);
    return res.status(500).json({ message: 'Unable to restore attachment.' });
  }
};

export const deleteAttachmentPermanently = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      ownerId: getOwnerId(req),
      isDeleted: true,
    });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    await Promise.allSettled([getBucket().delete(attachment.fileId)]);
    await attachment.deleteOne();
    return res.status(200).json({ message: 'Attachment permanently deleted.' });
  } catch (error) {
    console.error('Permanent attachment deletion error:', error);
    return res.status(500).json({ message: 'Unable to permanently delete attachment.' });
  }
};

export const clearTrashAttachments = async (req, res) => {
  try {
    const attachments = await Attachment.find({ ownerId: getOwnerId(req), isDeleted: true }).select('fileId');
    const bucket = getBucket();
    await Promise.allSettled(attachments.map(({ fileId }) => bucket.delete(fileId)));
    const result = await Attachment.deleteMany({ ownerId: getOwnerId(req), isDeleted: true });
    return res.status(200).json({ message: 'Deleted files cleared.', deletedCount: result.deletedCount || 0 });
  } catch (error) {
    console.error('Clear deleted attachments error:', error);
    return res.status(500).json({ message: 'Unable to clear deleted files.' });
  }
};

export const downloadAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, ownerId: getOwnerId(req) });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStream(attachment.fileId);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName.replace(/"/g, '')}"`);
    downloadStream.on('error', () => res.status(404).json({ message: 'File data not found.' }));
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Create download URL error:', error);
    return res.status(500).json({ message: 'Unable to prepare file download.' });
  }
};
