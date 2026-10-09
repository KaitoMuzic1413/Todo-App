import { useEffect, useMemo, useState, useRef } from 'react';
import { AudioLines, Download, Check, FileArchive, FileText, Image, Minus, Pencil, Pin, Plus, Star, Trash2, Upload, Video, X } from 'lucide-react';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatsAndFilters from '@/components/StatsAndFilters';
import TaskListPagination from '@/components/TaskListPagination';
import DateTimeFilter from '@/components/DateTimeFilter';
import { deleteAttachment, downloadAttachment, fetchAttachments, updateAttachment, uploadAttachment } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const PAGE_SIZE = 5;

const formatSize = (size = 0) => `${(size / 1024 / 1024).toFixed(2)} MB`;
const formatUploadedAt = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
const kindOf = (mime = '') => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
const titleOf = (attachment) => attachment.title || attachment.originalName;
const IconOf = ({ kind }) => kind === 'image' ? <Image className='h-5 w-5' /> : kind === 'video' ? <Video className='h-5 w-5' /> : kind === 'audio' ? <AudioLines className='h-5 w-5' /> : kind === 'file' ? <FileText className='h-5 w-5' /> : <FileArchive className='h-5 w-5' />;

const ArchivePage = () => {
  const { language, t, formatText } = useLanguage();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [filterKey, setFilterKey] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedFile, setSelectedFile] = useState(null);
  const [draft, setDraft] = useState({ content: '', caption: '' });
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  
  // State quản lý tệp đang chờ xác nhận tải lại
  const [confirmDownloadItem, setConfirmDownloadItem] = useState(null);

  const imageContainerRef = useRef(null);

  const loadAttachments = async () => {
    try {
      const response = await fetchAttachments();
      const normalizedData = (response?.data || []).map(item => ({
        ...item,
        createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
        starttime: item.starttime || item.createdAt || new Date().toISOString(),
      }));
      setAttachments(normalizedData);
    } catch {
      setMessage('Không thể tải danh sách tệp lưu trữ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadAttachments(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSelectedFile(file);
    setDraft({ 
      content: file.name.replace(/\.[^/.]+$/, ''), 
      caption: '' 
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile || !draft.content.trim()) return;

    try {
      setUploading(true);
      const uploadPayload = {
        title: draft.content,
        description: draft.caption,
      };
      await uploadAttachment(selectedFile, uploadPayload);
      setSelectedFile(null);
      setDraft({ content: '', caption: '' });
      setMessage('Tải lên thành công.');
      setCurrentPage(1);
      await loadAttachments();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Tải lên thất bại.');
    } finally {
      setUploading(false);
    }
  };

  // Hàm thực thi tải tệp xuống máy
  const processDownload = async (attachment) => {
    try {
      const response = await downloadAttachment(attachment._id);
      const fileName = attachment.originalName || 'download';

      // Sử dụng API chọn thư mục hệ thống hiện đại nếu trình duyệt hỗ trợ để bắt chính xác hành động Lưu/Hủy
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

      // Fallback truyền thống
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
      setMessage('Tải xuống thất bại.');
    }
  };

  // Xử lý khi nhấn nút Tải xuống trên giao diện
  const handleDownloadClick = (attachment) => {
    if (downloadedIds.has(attachment._id)) {
      // Nếu đã có trong danh sách đã tải -> Mở bảng xác nhận tải lại
      setConfirmDownloadItem(attachment);
    } else {
      // Chưa tải lần nào -> Tải luôn
      processDownload(attachment);
    }
  };

  const handlePreview = async (attachment) => {
    if (kindOf(attachment.mimeType) === 'file') return;
    try {
      const response = await downloadAttachment(attachment._id, true);
      setPreview({ attachment, url: URL.createObjectURL(response.data) });
      setZoomScale(1);
    } catch {
      setMessage('Không thể xem trước tệp này.');
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setZoomScale(1);
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
      setMessage('Đã xóa tệp.');
    } catch {
      setMessage('Xóa thất bại.');
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
      const now = new Date();
      nextItems = nextItems.filter((item) => {
        const itemDate = new Date(item.createdAt || item.starttime);
        if (isNaN(itemDate.getTime())) return true;

        if (timeFilter === 'today') {
          return itemDate.toDateString() === now.toDateString();
        } else if (timeFilter === 'thisWeek') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          return itemDate >= startOfWeek;
        } else if (timeFilter === 'thisMonth') {
          return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        return true;
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

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />

        <section className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>Tải lên tệp lưu trữ</h3>
              <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Hỗ trợ ảnh, video, âm thanh và tài liệu cá nhân.</p>
            </div>
            <label className={`inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all ${uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-violet-500'}`}>
              <Upload className='h-4 w-4' /> Chọn tệp tải lên
              <input 
                type='file' 
                disabled={uploading} 
                className='hidden' 
                onChange={chooseFile} 
                accept='image/*,video/*,audio/*,application/pdf,text/plain,text/markdown' 
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
            ['all', 'All files'],
            ['important', t.important || 'Important'],
            ['pinned', t.pinned || 'Pinned'],
          ]}
          customStats={[
            { label: 'All files', value: attachments.length, tone: 'violet' },
            { label: t.important || 'Important', value: attachments.filter((item) => item.important).length, tone: 'amber' },
            { label: t.pinned || 'Pinned', value: attachments.filter((item) => item.pinned).length, tone: 'sky' },
          ]}
        />

        {loading ? (
          <div className='rounded-[28px] border border-slate-200 bg-white/80 p-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
            Đang tải dữ liệu lưu trữ...
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='grid gap-3 sm:grid-cols-1'>
              {visibleAttachments.length === 0 && (
                <div className='rounded-[28px] border border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
                  Chưa có tệp nào trong mục này.
                </div>
              )}
              
              {visibleAttachments.map((attachment) => {
                const kind = kindOf(attachment.mimeType);
                const isDownloaded = downloadedIds.has(attachment._id);
                return (
                  <article 
                    key={attachment._id} 
                    onClick={() => handlePreview(attachment)} 
                    className={`rounded-2xl border p-4 transition ${kind !== 'file' ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700' : ''} ${attachment.pinned ? 'border-violet-300 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50'}`}
                  >
                    <div className='flex items-start gap-3'>
                      <div className='rounded-xl bg-white p-2.5 text-violet-500 shadow-sm dark:bg-slate-900'>
                        <IconOf kind={kind} />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-semibold text-slate-800 dark:text-slate-100'>{titleOf(attachment)}</p>
                        <p className='mt-1 truncate text-xs text-slate-400'>{attachment.description || attachment.originalName}</p>
                        <p className='mt-2 text-[11px] text-slate-400'>Tải lên {formatUploadedAt(attachment.createdAt, language)} · {formatSize(attachment.size)} · {kind === 'file' ? 'Tài liệu' : 'Nhấn để xem'}{attachment.taskId ? ' · Task đã liên kết' : ''}</p>
                      </div>
                      <div className='flex gap-1'>
                        <button type='button' onClick={(event) => { event.stopPropagation(); toggleAttachment(attachment, 'pinned'); }} className={attachment.pinned ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'} aria-label='Ghim tệp'>
                          <Pin className='h-4 w-4' />
                        </button>
                        <button type='button' onClick={(event) => { event.stopPropagation(); toggleAttachment(attachment, 'important'); }} className={attachment.important ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'} aria-label='Đánh dấu sao'>
                          <Star className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                    <div className='mt-3 flex justify-end gap-2'>
                      <button type='button' onClick={(event) => { event.stopPropagation(); setEditing(attachment); setDraft({ content: titleOf(attachment), caption: attachment.description || '' }); }} aria-label='Sửa tệp' className='rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'>
                        <Pencil className='h-4 w-4' />
                      </button>
                      <button 
                        type='button' 
                        onClick={(event) => { event.stopPropagation(); handleDownloadClick(attachment); }} 
                        aria-label={isDownloaded ? t.downloaded : t.download} 
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition ${
                          isDownloaded 
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm' 
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isDownloaded ? <Check className='h-4 w-4' /> : <Download className='h-4 w-4' />}
                        <span>{isDownloaded ? t.downloaded : t.download}</span>
                      </button>
                      <button type='button' onClick={(event) => { event.stopPropagation(); handleDelete(attachment._id); }} aria-label='Xóa tệp' className='rounded-full border border-rose-200 p-2 text-rose-500 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30'>
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </article>
                );
              })}
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

        {/* Modal Xác nhận tải lại tệp nếu đã tồn tại trạng thái Downloaded */}
        {confirmDownloadItem && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm' onClick={() => setConfirmDownloadItem(null)}>
            <div className='w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900' onClick={(e) => e.stopPropagation()}>
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
                  className='rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition'
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
                  className='rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-violet-500 transition'
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          </div>
        )}

        {(selectedFile || editing) && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm' onClick={() => selectedFile ? setSelectedFile(null) : setEditing(null)}>
            <form onSubmit={selectedFile ? handleUpload : saveAttachment} className='w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900' onClick={(e) => e.stopPropagation()}>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>
                  {selectedFile ? 'Thông tin tệp tải lên' : 'Chỉnh sửa tệp'}
                </h3>
                <button type='button' onClick={() => selectedFile ? setSelectedFile(null) : setEditing(null)} aria-label='Đóng' className='rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'>
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='mt-4 space-y-4'>
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    Nội dung / Tiêu đề <span className='text-rose-500'>*</span>
                  </label>
                  <input 
                    required 
                    value={draft.content} 
                    onChange={(event) => setDraft({ ...draft, content: event.target.value })} 
                    placeholder='Nhập nội dung bắt buộc...' 
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-transparent p-2.5 text-sm text-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500' 
                  />
                </div>

                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    Chú thích / Caption (Tùy chọn)
                  </label>
                  <textarea 
                    value={draft.caption} 
                    onChange={(event) => setDraft({ ...draft, caption: event.target.value })} 
                    placeholder='Thêm mô tả cho tệp này...' 
                    rows={3}
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-transparent p-2.5 text-sm text-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500' 
                  />
                </div>
              </div>

              <button type='submit' className='mt-6 w-full rounded-xl bg-violet-600 p-3 text-sm font-semibold text-white shadow-md hover:bg-violet-500 transition'>
                {selectedFile ? 'Xác nhận tải lên' : 'Lưu thay đổi'}
              </button>
            </form>
          </div>
        )}

        {preview && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm' onClick={closePreview}>
            <div className='relative max-h-[90vh] max-w-4xl flex flex-col items-center rounded-3xl bg-slate-900 p-6 shadow-2xl overflow-hidden border border-slate-800' onClick={(event) => event.stopPropagation()}>
              
              <div className='absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700'>
                {kindOf(preview.attachment.mimeType) === 'image' && (
                  <>
                    <button 
                      type='button' 
                      onClick={() => setZoomScale((s) => Math.max(s - 0.25, 0.5))} 
                      className='p-1.5 text-white hover:bg-slate-700 rounded-lg transition'
                      title='Thu nhỏ'
                    >
                      <Minus className='h-4 w-4' />
                    </button>
                    <span className='text-xs font-medium text-slate-300 min-w-[3rem] text-center'>
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button 
                      type='button' 
                      onClick={() => setZoomScale((s) => Math.min(s + 0.25, 3))} 
                      className='p-1.5 text-white hover:bg-slate-700 rounded-lg transition'
                      title='Phóng to'
                    >
                      <Plus className='h-4 w-4' />
                    </button>
                    <div className='h-4 w-[1px] bg-slate-700 mx-1' />
                  </>
                )}
                <button 
                  type='button' 
                  onClick={closePreview} 
                  className='p-1.5 text-white hover:bg-rose-600 rounded-lg transition'
                  title='Đóng'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>

              <div 
                ref={imageContainerRef}
                onWheel={(e) => {
                  if (kindOf(preview.attachment.mimeType) === 'image') {
                    e.preventDefault();
                    const delta = e.deltaY < 0 ? 0.15 : -0.15;
                    setZoomScale((s) => Math.min(Math.max(s + delta, 0.5), 3));
                  }
                }}
                onTouchStart={(e) => {
                  if (e.touches.length === 2 && kindOf(preview.attachment.mimeType) === 'image') {
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
                  if (e.touches.length === 2 && kindOf(preview.attachment.mimeType) === 'image' && imageContainerRef.current) {
                    e.preventDefault();
                    const dist = Math.hypot(
                      e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY
                    );
                    const initialDist = parseFloat(imageContainerRef.current.dataset.initialDist || dist);
                    const initialScale = parseFloat(imageContainerRef.current.dataset.initialScale || zoomScale);
                    const newScale = Math.min(Math.max((dist / initialDist) * initialScale, 0.5), 3);
                    setZoomScale(newScale);
                  }
                }}
                className='flex flex-1 items-center justify-center overflow-auto max-h-[70vh] w-full py-8 touch-none'
              >
                {kindOf(preview.attachment.mimeType) === 'image' && (
                  <img 
                    src={preview.url} 
                    alt={titleOf(preview.attachment)} 
                    style={{ transform: `scale(${zoomScale})`, transition: 'transform 0.1s ease-out' }}
                    className='max-h-[60vh] max-w-full object-contain cursor-grab rounded-lg select-none' 
                  />
                )}
                {kindOf(preview.attachment.mimeType) === 'video' && (
                  <video src={preview.url} controls autoPlay className='max-h-[65vh] max-w-full rounded-lg shadow-lg' />
                )}
                {kindOf(preview.attachment.mimeType) === 'audio' && (
                  <div className='flex flex-col items-center gap-5 p-12 text-white'>
                    <AudioLines className='h-16 w-16 text-violet-400 animate-pulse' />
                    <audio src={preview.url} controls autoPlay className='w-80' />
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