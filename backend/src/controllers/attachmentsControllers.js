import mongoose from 'mongoose';
import Attachment from '../models/Attachment.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain|text\/markdown)$/;

const getOwnerId = (req) => req.user?.userId;

const getBucket = () => {
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });
};

export const uploadAttachment = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const { taskId = null } = req.body;
    const file = req.file;

    if (!ownerId || !file) {
      return res.status(400).json({ message: 'A file is required.' });
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
    const attachments = await Attachment.find({ ownerId: getOwnerId(req) }).sort({ createdAt: -1 });
    return res.status(200).json(attachments);
  } catch (error) {
    console.error('List attachments error:', error);
    return res.status(500).json({ message: 'Unable to load file archive.' });
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, ownerId: getOwnerId(req) });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });

    const bucket = getBucket();
    await bucket.delete(attachment.fileId);
    await attachment.deleteOne();
    return res.status(200).json({ message: 'Attachment deleted.' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return res.status(500).json({ message: 'Unable to delete attachment.' });
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
