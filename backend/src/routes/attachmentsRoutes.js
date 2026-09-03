import express from 'express';
import multer from 'multer';
import verifyToken from '../middleware/authMiddleware.js';
import { downloadAttachment, deleteAttachment, listAttachments, uploadAttachment } from '../controllers/attachmentsControllers.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(verifyToken);
router.post('/upload', (req, res, next) => {
	upload.single('file')(req, res, (error) => {
		if (error?.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({ message: 'Files must be smaller than 10 MB.' });
		}
		if (error) return res.status(400).json({ message: 'Unable to read this file.' });
		return next();
	});
}, uploadAttachment);
router.get('/', listAttachments);
router.get('/:id/download', downloadAttachment);
router.delete('/:id', deleteAttachment);

export default router;
