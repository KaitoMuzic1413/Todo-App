import mongoose from 'mongoose';
import Attachment from '../models/Attachment.js';
import Task from '../models/Task.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp|bmp|svg\+xml|heic|heif|avif)|audio\/(mpeg|wav|x-wav|ogg|aac|mp4|opus|flac|x-flac|x-ms-wma|midi|x-midi)|application\/(pdf|rtf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.oasis\.opendocument\.(text|spreadsheet|presentation)|vnd\.ms-excel|vnd\.ms-powerpoint|json|xml)|text\/(plain|markdown|x-markdown|csv|xml))$/i;
const ALLOWED_FILE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif',
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wma', 'mid', 'midi',
  'txt', 'md', 'markdown', 'rtf', 'pdf', 'doc', 'docx', 'odt',
  'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp', 'csv', 'json', 'xml',
]);
const VIDEO_FILE_EXTENSION = /\.(mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp)$/i;
let legacyAttachmentTtlIndexRemoved = false;

const getOwnerId = (req) => req.user?.userId;

export const cleanupExpiredTrashAttachments = async () => {
  try {
    if (!legacyAttachmentTtlIndexRemoved) {
      try {
        await Attachment.collection.dropIndex('deletedAt_1');
      } catch (error) {
        if (error.code !== 27 && error.codeName !== 'IndexNotFound') throw error;
      }
      legacyAttachmentTtlIndexRemoved = true;
    }
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expired = await Attachment.find({ isDeleted: true, deletedAt: { $lte: cutoff } }).select('_id fileId');
    if (!expired.length) return 0;

    const bucket = getBucket();
    const results = await Promise.allSettled(expired.map(({ fileId }) => bucket.delete(fileId)));
    const successfullyDeletedIds = expired
      .filter((_, index) => results[index].status === 'fulfilled')
      .map(({ _id }) => _id);
    if (successfullyDeletedIds.length) await Attachment.deleteMany({ _id: { $in: successfullyDeletedIds } });
    return successfullyDeletedIds.length;
  } catch (error) {
    console.error('Expired attachment cleanup error:', error);
    return 0;
  }
};

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
    const { taskId = null, title = '', description = '' } = req.body;
    const file = req.file;

    if (!ownerId || !file) {
      return res.status(400).json({ message: 'A file is required.' });
    }
    if (!title.trim()) {
      return res.status(400).json({ message: 'File title is required.' });
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
    if (file.mimetype.toLowerCase().startsWith('video/') || VIDEO_FILE_EXTENSION.test(file.originalname)) {
      return res.status(400).json({ message: 'Video files cannot be uploaded to the archive.' });
    }
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.test(file.mimetype) && !ALLOWED_FILE_EXTENSIONS.has(extension)) {
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
      title: title.trim(),
      description: description.trim(),
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
    const attachments = await Attachment.find({ ownerId: getOwnerId(req), isDeleted: false })
      .sort({ pinned: -1, createdAt: -1 });
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

export const updateAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      ownerId: getOwnerId(req),
      isDeleted: false,
    });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    const { title, description, pinned, important } = req.body;
    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ message: 'Image title is required.' });
    }
    if (title !== undefined) attachment.title = String(title).trim();
    if (description !== undefined) attachment.description = String(description).trim();
    if (pinned !== undefined) attachment.pinned = Boolean(pinned);
    if (important !== undefined) attachment.important = Boolean(important);
    await attachment.save();
    return res.status(200).json({ attachment });
  } catch (error) {
    console.error('Update attachment error:', error);
    return res.status(500).json({ message: 'Unable to update file.' });
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
    const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.originalName.replace(/"/g, '')}"`);
    downloadStream.on('error', () => res.status(404).json({ message: 'File data not found.' }));
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Create download URL error:', error);
    return res.status(500).json({ message: 'Unable to prepare file download.' });
  }
};
