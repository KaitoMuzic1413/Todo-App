import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AudioLines, Download, Check, FileArchive, FileText, Image, Minus, Pencil, Pin, Plus, Star, Trash2, Upload, Video, X } from 'lucide-react';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatsAndFilters from '@/components/StatsAndFilters';
import TaskListPagination from '@/components/TaskListPagination';
import DateTimeFilter from '@/components/DateTimeFilter';
import { deleteAttachment, downloadAttachment, fetchAttachments, updateAttachment, uploadAttachment } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { keepTextareaContentVisible } from '@/lib/textareaSizing';
import { getCreatedAtRange, isDateInRange } from '@/lib/dateFilters';
import { getAttachmentType, groupAttachmentsByType } from '@/lib/attachmentTypes';

const PAGE_SIZE = 5;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const formatSize = (size = 0) => `${(size / 1024 / 1024).toFixed(2)} MB`;
const formatUploadedAt = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
const kindOf = (attachment) => getAttachmentType(attachment);
const titleOf = (attachment) => attachment.title || attachment.originalName;
const IconOf = ({ kind }) => kind === 'image' ? <Image className='h-5 w-5' /> : kind === 'video' ? <Video className='h-5 w-5' /> : kind === 'audio' ? <AudioLines className='h-5 w-5' /> : kind === 'document' ? <FileText className='h-5 w-5' /> : <FileArchive className='h-5 w-5' />;
const typeLabel = (type, t) => ({
  image: t.fileTypeImages,
  video: t.fileTypeVideos,
  audio: t.fileTypeAudio,
  document: t.fileTypeDocuments,
  other: t.fileTypeOther,
})[type] || t.fileTypeOther;

const ArchivePage = () => {
  const { language, t, formatText } = useLanguage();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');

  const [filterKey, setFilterKey] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedFile, setSelectedFile] = useState(null);
  const [draft, setDraft] = useState({ content: '', caption: '' });
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);
  const [downloadedIds, setDownloadedIds] = useState(new Set());

  const [confirmDownloadItem, setConfirmDownloadItem] = useState(null);

  const imageContainerRef = useRef(null);

  // Gắn sự kiện wheel non-passive để chặn cuộn trang hoàn toàn khi zoom ảnh
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const handleWheelNative = (e) => {
      if (preview && kindOf(preview.attachment) === 'image') {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoomScale((s) => {
          const next = Math.min(Math.max(s + delta, 0.5), 3);
          if (next <= 1) setPanOffset({ x: 0, y: 0 });
          return next;
        });
      }
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, [preview]);

  // Lắng nghe sự kiện mouseup và mousemove trên window để dù kéo ra ngoài màn hình thả ra cũng không bị mất kiểm soát hay thoát modal
  useEffect(() => {
    const handleWindowMouseMove = (event) => {
      if (!panStartRef.current || !imageContainerRef.current) return;
      const rawX = panStartRef.current.offsetX + event.clientX - panStartRef.current.clientX;
      const rawY = panStartRef.current.offsetY + event.clientY - panStartRef.current.clientY;

      const container = imageContainerRef.current;
      const maxLimitX = (container.clientWidth * (zoomScale - 1)) / 2;
      const maxLimitY = (container.clientHeight * (zoomScale - 1)) / 2;

      setPanOffset({
        x: Math.max(Math.min(rawX, maxLimitX), -maxLimitX),
        y: Math.max(Math.min(rawY, maxLimitY), -maxLimitY),
      });
    };

    const handleWindowMouseUp = () => {
      if (panStartRef.current) {
        panStartRef.current = null;
        setIsPanning(false);
      }
    };

    if (preview) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [preview, zoomScale]);

  const loadAttachments = useCallback(async () => {
    try {
      const response = await fetchAttachments();
      const normalizedData = (response?.data || []).map(item => ({
        ...item,
        createdAt: item.createdAt || null,
        starttime: item.starttime || item.createdAt || null,
      }));
      setAttachments(normalizedData);
    } catch {
      setMessage(t.loadArchiveFailed);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadAttachments(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAttachments]);

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type.toLowerCase().startsWith('video/') || kindOf({ originalName: file.name }) === 'video') {
      setSelectedFile(null);
      setMessage(t.videoUploadNotSupported);
      return;
    }
    setSelectedFile(file);
    setDraft({
      content: file.name.replace(/\.[^/.]+$/, ''),
      caption: ''
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile || !draft.content.trim()) return;
    if (selectedFile.size > MAX_UPLOAD_SIZE) {
      setMessage(t.fileTooLarge);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      const uploadPayload = {
        title: draft.content,
        description: draft.caption,
        onUploadProgress: setUploadProgress,
      };
      await uploadAttachment(selectedFile, uploadPayload);
      setSelectedFile(null);
      setDraft({ content: '', caption: '' });
      setMessage(t.uploadSuccess);
      setUploadProgress(0);
      setCurrentPage(1);
      await loadAttachments();
    } catch (error) {
      const serverMessage = String(error?.response?.data?.message || '').toLowerCase();
      if (serverMessage.includes('video')) {
        setMessage(t.videoUploadNotSupported);
      } else if (serverMessage.includes('10 mb') || serverMessage.includes('file too large') || serverMessage.includes('file size')) {
        setMessage(t.fileTooLarge);
      } else {
        setMessage(t.uploadFailed);
      }
    } finally {
      setUploading(false);
    }
  };

  const processDownload = async (attachment) => {
    try {
      const response = await downloadAttachment(attachment._id);
      const fileName = attachment.originalName || 'download';

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: fileName });
          const writable = await handle.createWritable();
          await writable.write(response.data);
          await writable.close();

          setDownloadedIds((prev) => {
            const next = new Set(prev);
            next.add(attachment._id);
            return next;
          });
          setMessage(t.fileDownloadedSuccess);
          return;
        } catch (err) {
          if (err.name === 'AbortError') {
            setMessage(t.fileDownloadCancelled);
            return;
          }
        }
      }

      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(attachment._id);
        return next;
      });
      setMessage(t.fileDownloadedSuccess);
    } catch {
      setMessage(t.downloadFailed);
    }
  };

  const handleDownloadClick = (attachment) => {
    if (downloadedIds.has(attachment._id)) {
      setConfirmDownloadItem(attachment);
    } else {
      processDownload(attachment);
    }
  };

  const handlePreview = async (attachment) => {
    if (!['image', 'video', 'audio'].includes(kindOf(attachment))) return;
    try {
      const response = await downloadAttachment(attachment._id, true);
      setPreview({ attachment, url: URL.createObjectURL(response.data) });
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    } catch {
      setMessage(t.previewFailed);
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const saveAttachment = async (event) => {
    event.preventDefault();
    const response = await updateAttachment(editing._id, {
      title: draft.content,
      description: draft.caption,
    });
    setAttachments((current) => current.map((item) => item._id === editing._id ? { ...response.data.attachment, createdAt: response.data.attachment.createdAt || item.createdAt } : item));
    setEditing(null);
  };

  const toggleAttachment = async (attachment, field) => {
    const response = await updateAttachment(attachment._id, { [field]: !attachment[field] });
    setAttachments((current) => current.map((item) => item._id === attachment._id ? { ...response.data.attachment, createdAt: response.data.attachment.createdAt || item.createdAt } : item));
  };

  const handleDelete = async (attachmentId) => {
    try {
      await deleteAttachment(attachmentId);
      setAttachments((current) => current.filter((att) => att._id !== attachmentId));
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
      setMessage(t.deleteFileSuccess);
    } catch {
      setMessage(t.deleteFileFailed);
    }
  };

  const filteredAttachments = useMemo(() => {
    let nextItems = [...attachments];

    if (filterKey === 'pinned') {
      nextItems = nextItems.filter((item) => item.pinned);
    } else if (filterKey === 'important') {
      nextItems = nextItems.filter((item) => item.important);
    }

    if (timeFilter && timeFilter !== 'all') {
      const range = getCreatedAtRange(timeFilter);
      nextItems = nextItems.filter((item) => {
        return isDateInRange(item.createdAt, range);
      });
    }

    return nextItems.sort((left, right) => {
      if (Boolean(right.pinned) !== Boolean(left.pinned)) return Number(right.pinned) - Number(left.pinned);
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [attachments, filterKey, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAttachments.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleAttachments = useMemo(
    () => filteredAttachments.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [safeCurrentPage, filteredAttachments]
  );
  const visibleGroups = useMemo(() => groupAttachmentsByType(visibleAttachments), [visibleAttachments]);
  const showTypeHeadings = visibleGroups.length > 1;

  return (
    <LayoutShell>
      <div className='box-border w-full min-w-0 max-w-full space-y-6 overflow-x-hidden px-0'>
        <Header />

        <section className='min-w-0 rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='flex w-full min-w-0 flex-wrap items-start justify-between gap-3'>
            <div className='w-full min-w-0 flex-1 break-words sm:w-auto'>
              <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.uploadArchiveTitle}</h3>
              <p className='mt-1 max-w-full break-words text-sm text-slate-500 dark:text-slate-400'>{t.uploadArchiveSubtitle}</p>
            </div>
            <label className={`inline-flex max-w-full shrink-0 items-center justify-center gap-2 self-start whitespace-normal rounded-3xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all ${uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-violet-500'}`}>
              <Upload className='h-4 w-4' /> {t.chooseFile}
              <input
                type='file'
                disabled={uploading}
                className='hidden'
                onChange={chooseFile}
                accept='image/*,audio/*,application/pdf,text/plain,text/markdown,.rtf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.csv,.json,.xml'
              />
            </label>
          </div>
          {message && (
            <p className='mt-3 text-sm font-medium text-slate-600 dark:text-slate-300'>{message}</p>
          )}
        </section>

        <StatsAndFilters
          tasks={attachments}
          activeFilter={filterKey}
          onFilterChange={(key) => {
            setFilterKey(key);
            setCurrentPage(1);
          }}
          customFilters={[
            ['all', t.allFiles],
            ['important', t.important || 'Important'],
            ['pinned', t.pinned || 'Pinned'],
          ]}
          customStats={[
            { label: t.allFiles, value: attachments.length, tone: 'violet' },
            { label: t.important || 'Important', value: attachments.filter((item) => item.important).length, tone: 'amber' },
            { label: t.pinned || 'Pinned', value: attachments.filter((item) => item.pinned).length, tone: 'sky' },
          ]}
        />

        {loading ? (
          <div className='rounded-3xl border border-slate-200 bg-white/80 p-5 text-slate-500 shadow-md dark:border-slate-800 dark:bg-slate-900/70'>
            {t.loadingArchive}
          </div>
        ) : (
          <div className='w-full min-w-0 max-w-full space-y-4'>
            <div className='grid w-full min-w-0 max-w-full grid-cols-1 gap-3'>
              {visibleAttachments.length === 0 && (
                <div className='rounded-3xl border border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-500 shadow-md dark:border-slate-800 dark:bg-slate-900/70'>
                  {t.noFilesInCategory}
                </div>
              )}

              {visibleGroups.map(([groupType, groupItems]) => (
                <section key={groupType} className='w-full min-w-0 max-w-full space-y-3'>
                  {showTypeHeadings && <h2 className='flex items-center gap-2 px-1 text-sm font-semibold text-slate-600 dark:text-slate-300'><IconOf kind={groupType} />{typeLabel(groupType, t)} <span className='text-xs font-normal text-slate-400'>({groupItems.length})</span></h2>}
                  {groupItems.map((attachment) => {
                    const kind = kindOf(attachment);
                    const isDownloaded = downloadedIds.has(attachment._id);
                    return (
                  <article
                    key={attachment._id}
                    onClick={() => handlePreview(attachment)}
                    className={`box-border flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-3xl border p-3 shadow-sm transition-all duration-300 hover:border-violet-300 hover:shadow-md sm:gap-4 sm:p-4 dark:hover:border-violet-700 ${attachment.pinned ? 'border-violet-300 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50'}`}
                  >
                    <div className='flex w-full min-w-0 items-start gap-3'>
                      <div className='shrink-0 rounded-3xl bg-white p-2.5 text-violet-500 shadow-sm dark:bg-slate-900'>
                        <IconOf kind={kind} />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-sm font-medium text-slate-800 dark:text-slate-100'>{titleOf(attachment)}</p>
                        <p className='mt-1 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs text-slate-400'>{attachment.description || attachment.originalName}</p>
                        <p className='mt-2 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs leading-relaxed text-slate-400'>{t.uploadedLabel} {formatUploadedAt(attachment.createdAt, language)} · {formatSize(attachment.size)} · {kind === 'document' || kind === 'other' ? t.document : t.tapToView}{attachment.taskId ? ` · ${t.linkedTask}` : ''}</p>
                      </div>
                      <div className='flex shrink-0 flex-col gap-2 sm:flex-row sm:gap-1'>
                        <button type='button' onClick={(event) => { event.stopPropagation(); toggleAttachment(attachment, 'pinned'); }} className={attachment.pinned ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'} aria-label={t.pinFile} title={t.pinFile}>
                          <Pin className='h-4 w-4' />
                        </button>
                        <button type='button' onClick={(event) => { event.stopPropagation(); toggleAttachment(attachment, 'important'); }} className={attachment.important ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'} aria-label={t.starFile} title={t.starFile}>
                          <Star className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                    <div className='flex w-full min-w-0 flex-wrap items-center justify-start gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-700/70'>
                      <button type='button' onClick={(event) => { event.stopPropagation(); setEditing(attachment); setDraft({ content: titleOf(attachment), caption: attachment.description || '' }); }} aria-label={t.editFile} title={t.editFile} className='rounded-3xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'>
                        <Pencil className='h-4 w-4' />
                      </button>
                      <button
                        type='button'
                        onClick={(event) => { event.stopPropagation(); handleDownloadClick(attachment); }}
                        aria-label={isDownloaded ? t.downloaded : t.download}
                        className={`inline-flex items-center gap-1.5 rounded-3xl border px-3 py-2 text-xs font-medium transition ${
                          isDownloaded
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isDownloaded ? <Check className='h-4 w-4' /> : <Download className='h-4 w-4' />}
                        <span>{isDownloaded ? t.downloaded : t.download}</span>
                      </button>
                      <button type='button' onClick={(event) => { event.stopPropagation(); handleDelete(attachment._id); }} aria-label={t.deleteFile} title={t.deleteFile} className='rounded-3xl border border-rose-200 p-2 text-rose-500 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30'>
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </article>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        )}

        <div className='flex w-full flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center'>
          <TaskListPagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
          <DateTimeFilter
            value={timeFilter}
            onChange={(value) => {
              setTimeFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>

        {confirmDownloadItem && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm' onClick={() => setConfirmDownloadItem(null)}>
            <div className='w-full min-w-0 max-w-sm rounded-3xl bg-white p-4 shadow-2xl sm:p-6 dark:bg-slate-900' onClick={(e) => e.stopPropagation()}>
              <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>
                {t.downloadAgainTitle}
              </h3>
              <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>
                {formatText('downloadAgainMessage', { filename: titleOf(confirmDownloadItem) })}
              </p>
              <div className='mt-6 flex justify-end gap-2'>
                <button
                  type='button'
                  onClick={() => setConfirmDownloadItem(null)}
                  className='rounded-3xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition'
                >
                  {t.cancel}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    const item = confirmDownloadItem;
                    setConfirmDownloadItem(null);
                    processDownload(item);
                  }}
                  className='rounded-3xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-violet-500 transition'
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          </div>
        )}

        {(selectedFile || editing) && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm' onClick={() => { if (!uploading) selectedFile ? setSelectedFile(null) : setEditing(null); }}>
            <form onSubmit={selectedFile ? handleUpload : saveAttachment} className='w-full min-w-0 max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6 dark:bg-slate-900' onClick={(e) => e.stopPropagation()}>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>
                  {selectedFile ? t.fileInfoTitle : t.editFileTitle}
                </h3>
                <button type='button' disabled={uploading} onClick={() => selectedFile ? setSelectedFile(null) : setEditing(null)} aria-label={t.close} className='rounded-3xl p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800'>
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='mt-4 space-y-4'>
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    {t.contentOrTitle} <span className='text-rose-500'>*</span>
                  </label>
                  <input
                    required
                    disabled={uploading}
                    value={draft.content}
                    onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                    placeholder={t.contentPlaceholder}
                    className='mt-1 w-full rounded-3xl border border-slate-200 bg-transparent p-2.5 text-sm text-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500'
                  />
                </div>

                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    {t.captionOptional}
                  </label>
                  <textarea
                    disabled={uploading}
                    value={draft.caption}
                    onChange={(event) => {
                      keepTextareaContentVisible(event.currentTarget);
                      setDraft({ ...draft, caption: event.target.value });
                    }}
                    placeholder={t.captionPlaceholder}
                    rows={3}
                    className='mt-1 w-full resize-y rounded-3xl border border-slate-200 bg-transparent p-2.5 text-sm text-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500'
                  />
                </div>
                {selectedFile && (
                  <p className={`text-xs ${selectedFile.size > MAX_UPLOAD_SIZE ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{selectedFile.size > MAX_UPLOAD_SIZE ? t.fileTooLarge : t.maxUploadSize}</p>
                )}
                {uploading && (
                  <div className='space-y-2' role='status' aria-live='polite'>
                    <div className='flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300'>
                      <span>{kindOf({ mimeType: selectedFile?.type, originalName: selectedFile?.name }) === 'video' ? t.uploadingVideo : t.uploadingFile}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className='h-2 overflow-hidden rounded-3xl bg-slate-200 dark:bg-slate-700'>
                      <div className='h-full rounded-3xl bg-violet-600 transition-[width] duration-200' style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <button type='submit' disabled={uploading || (selectedFile && selectedFile.size > MAX_UPLOAD_SIZE)} className='mt-6 w-full rounded-3xl bg-violet-600 p-3 text-sm font-semibold text-white shadow-md hover:bg-violet-500 transition disabled:cursor-not-allowed disabled:opacity-60'>
                {uploading ? t.uploading : selectedFile ? t.confirmUpload : t.saveChanges}
              </button>
            </form>
          </div>
        )}

        {preview && (
          <div 
            className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-2 backdrop-blur-sm select-none sm:p-4' 
            onClick={closePreview}
          >
            <div className='relative flex max-h-[90dvh] w-full min-w-0 max-w-4xl flex-col items-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-3 shadow-2xl sm:p-6' onClick={(event) => event.stopPropagation()}>

              <div className='absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md p-1.5 rounded-3xl border border-slate-700'>
                {kindOf(preview.attachment) === 'image' && (
                  <>
                    <button
                      type='button'
                      onClick={() => setZoomScale((s) => Math.max(s - 0.25, 0.5))}
                      className='p-1.5 text-white hover:bg-slate-700 rounded-3xl transition'
                      title={t.zoomOut}
                    >
                      <Minus className='h-4 w-4' />
                    </button>
                    <span className='text-xs font-medium text-slate-300 min-w-[3rem] text-center'>
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type='button'
                      onClick={() => setZoomScale((s) => Math.min(s + 0.25, 3))}
                      className='p-1.5 text-white hover:bg-slate-700 rounded-3xl transition'
                      title={t.zoomIn}
                    >
                      <Plus className='h-4 w-4' />
                    </button>
                    <div className='h-4 w-[1px] bg-slate-700 mx-1' />
                  </>
                )}
                <button
                  type='button'
                  onClick={closePreview}
                  className='p-1.5 text-white hover:bg-rose-600 rounded-3xl transition'
                  title={t.close}
                >
                  <X className='h-4 w-4' />
                </button>
              </div>

              <div
                ref={imageContainerRef}
                onMouseDown={(event) => {
                  if (kindOf(preview.attachment) !== 'image' || zoomScale <= 1) return;
                  panStartRef.current = { clientX: event.clientX, clientY: event.clientY, offsetX: panOffset.x, offsetY: panOffset.y };
                  setIsPanning(true);
                }}
                onTouchStart={(e) => {
                  if (kindOf(preview.attachment) !== 'image') return;
                  if (e.touches.length === 1 && zoomScale > 1) {
                    imageContainerRef.current.dataset.panX = panOffset.x;
                    imageContainerRef.current.dataset.panY = panOffset.y;
                    imageContainerRef.current.dataset.touchX = e.touches[0].clientX;
                    imageContainerRef.current.dataset.touchY = e.touches[0].clientY;
                  }
                  if (e.touches.length === 2) {
                    const dist = Math.hypot(
                      e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY
                    );
                    if (imageContainerRef.current) {
                      imageContainerRef.current.dataset.initialDist = dist;
                      imageContainerRef.current.dataset.initialScale = zoomScale;
                    }
                  }
                }}
                onTouchMove={(e) => {
                  if (kindOf(preview.attachment) === 'image' && imageContainerRef.current && e.touches.length === 2) {
                    e.preventDefault();
                    const dist = Math.hypot(
                      e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY
                    );
                    const initialDist = parseFloat(imageContainerRef.current.dataset.initialDist || dist);
                    const initialScale = parseFloat(imageContainerRef.current.dataset.initialScale || zoomScale);
                    const newScale = Math.min(Math.max((dist / initialDist) * initialScale, 0.5), 3);
                    setZoomScale(newScale);
                    if (newScale <= 1) setPanOffset({ x: 0, y: 0 });
                  } else if (kindOf(preview.attachment) === 'image' && imageContainerRef.current && e.touches.length === 1 && zoomScale > 1) {
                    e.preventDefault();
                    const container = imageContainerRef.current;
                    const rawX = Number(container.dataset.panX || 0) + e.touches[0].clientX - Number(container.dataset.touchX || e.touches[0].clientX);
                    const rawY = Number(container.dataset.panY || 0) + e.touches[0].clientY - Number(container.dataset.touchY || e.touches[0].clientY);

                    const maxLimitX = (container.clientWidth * (zoomScale - 1)) / 2;
                    const maxLimitY = (container.clientHeight * (zoomScale - 1)) / 2;

                    setPanOffset({
                      x: Math.max(Math.min(rawX, maxLimitX), -maxLimitX),
                      y: Math.max(Math.min(rawY, maxLimitY), -maxLimitY),
                    });
                  }
                }}
                className='flex flex-1 items-center justify-center overflow-hidden max-h-[70vh] w-full py-8 touch-none cursor-grab active:cursor-grabbing'
              >
                {kindOf(preview.attachment) === 'image' && (
                  <img
                    src={preview.url}
                    alt={titleOf(preview.attachment)}
                    onDragStart={(e) => e.preventDefault()}
                    style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}
                    className='max-h-[60vh] max-w-full object-contain rounded-3xl select-none'
                  />
                )}
                {kindOf(preview.attachment) === 'video' && (
                  <video src={preview.url} controls onClick={(event) => { const video = event.currentTarget; if (video.paused) void video.play(); else video.pause(); }} className='max-h-[65vh] max-w-full rounded-3xl shadow-lg' />
                )}
                {kindOf(preview.attachment) === 'audio' && (
                  <div className='flex w-full min-w-0 flex-col items-center gap-5 p-4 text-white sm:p-12'>
                    <AudioLines className='h-16 w-16 text-violet-400 animate-pulse' />
                    <audio src={preview.url} controls autoPlay className='w-full max-w-80' />
                  </div>
                )}
              </div>

              <div className='w-full border-t border-slate-800 pt-4 text-left'>
                <h4 className='font-bold text-base truncate text-white'>{titleOf(preview.attachment)}</h4>
                {preview.attachment.description && (
                  <p className='mt-1 text-xs text-slate-400 whitespace-pre-wrap'>{preview.attachment.description}</p>
                )}
              </div>

            </div>
          </div>
        )}

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default ArchivePage;
