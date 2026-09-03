import { useEffect, useState } from 'react';
import { Download, FileArchive, Trash2, Upload } from 'lucide-react';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { deleteAttachment, downloadAttachment, fetchAttachments, uploadAttachment } from '@/lib/api';

const formatSize = (size) => `${(size / 1024 / 1024).toFixed(2)} MB`;

const ArchivePage = () => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadAttachments = async () => {
    try {
      const response = await fetchAttachments();
      setAttachments(response.data || []);
    } catch {
      setMessage('Unable to load file archive.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setMessage('Uploading...');
      await uploadAttachment(file);
      setMessage('File uploaded.');
      await loadAttachments();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Upload failed.');
    }
  };

  const handleDownload = async (attachmentId) => {
    try {
      const response = await downloadAttachment(attachmentId);
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachments.find((attachment) => attachment._id === attachmentId)?.originalName || 'download';
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setMessage('Download failed.');
    }
  };

  const handleDelete = async (attachmentId) => {
    try {
      await deleteAttachment(attachmentId);
      setAttachments((current) => current.filter((attachment) => attachment._id !== attachmentId));
    } catch {
      setMessage('Delete failed.');
    }
  };

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />
        <section className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h2 className='text-xl font-semibold text-slate-900 dark:text-white'>File archive</h2>
              <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Private files stored in your account.</p>
            </div>
            <label className='inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500'>
              <Upload className='h-4 w-4' /> Upload file
              <input type='file' className='hidden' onChange={handleUpload} accept='image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown' />
            </label>
          </div>
          {message ? <p className='mt-4 text-sm text-slate-500 dark:text-slate-400'>{message}</p> : null}
          <div className='mt-5 space-y-2'>
            {loading ? <p className='text-sm text-slate-500'>Loading...</p> : null}
            {!loading && attachments.length === 0 ? <p className='text-sm text-slate-500'>No files yet.</p> : null}
            {attachments.map((attachment) => (
              <div key={attachment._id} className='flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50'>
                <div className='flex min-w-0 items-center gap-3'>
                  <FileArchive className='h-5 w-5 shrink-0 text-violet-500' />
                  <div className='min-w-0'><p className='truncate text-sm font-medium text-slate-800 dark:text-slate-100'>{attachment.originalName}</p><p className='text-xs text-slate-400'>{formatSize(attachment.size)}</p></div>
                </div>
                <div className='flex shrink-0 gap-2'>
                  <button type='button' onClick={() => handleDownload(attachment._id)} className='rounded-full border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200' aria-label='Download file'><Download className='h-4 w-4' /></button>
                  <button type='button' onClick={() => handleDelete(attachment._id)} className='rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-500 dark:border-rose-900/60 dark:bg-rose-500/10' aria-label='Delete file'><Trash2 className='h-4 w-4' /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LayoutShell>
  );
};

export default ArchivePage;
