import { useEffect, useRef, useState } from 'react';
import { Check, Cookie, FileText, ShieldCheck, X } from 'lucide-react';
import { policies } from '@/pages/LegalPoliciesPage';

const policyOrder = ['privacy', 'terms', 'cookies'];
const icons = { privacy: ShieldCheck, terms: FileText, cookies: Cookie };

const LegalConsentModal = ({ open, onAccept, onDecline }) => {
  const contentRef = useRef(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasReachedEnd(false);
      return undefined;
    }

    const content = contentRef.current;
    if (!content) return undefined;

    const checkScrollEnd = () => {
      setHasReachedEnd(content.scrollHeight <= content.clientHeight + 2
        || content.scrollTop + content.clientHeight >= content.scrollHeight - 8);
    };

    const frame = window.requestAnimationFrame(checkScrollEnd);
    content.addEventListener('scroll', checkScrollEnd, { passive: true });
    window.addEventListener('resize', checkScrollEnd);
    return () => {
      window.cancelAnimationFrame(frame);
      content.removeEventListener('scroll', checkScrollEnd);
      window.removeEventListener('resize', checkScrollEnd);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onDecline();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onDecline]);

  if (!open) return null;

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-6' role='presentation'>
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='legal-consent-title'
        className='flex max-h-[min(92dvh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-violet-200/70 bg-white shadow-[0_28px_100px_rgba(124,58,237,0.35)] dark:border-violet-400/20 dark:bg-slate-900 dark:shadow-[0_28px_100px_rgba(139,92,246,0.3)]'
      >
        <header className='flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-8 sm:py-6'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300'>Kaito Todo · Xác nhận chính sách</p>
            <h2 id='legal-consent-title' className='mt-2 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl'>Chính sách quyền riêng tư, điều khoản sử dụng và chính sách cookie & lưu trữ</h2>
            <p className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>Cuộn xuống hết nội dung để bật nút Chấp nhận.</p>
          </div>
          <button type='button' onClick={onDecline} aria-label='Đóng cửa sổ chính sách' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'>
            <X className='h-5 w-5' />
          </button>
        </header>

        <div ref={contentRef} className='sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7'>
          {policyOrder.map((key) => {
            const policy = policies[key];
            const Icon = icons[key];
            return (
              <section key={key} className='mb-8 last:mb-2'>
                <div className='flex items-start gap-3'>
                  <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'><Icon className='h-5 w-5' /></span>
                  <div>
                    <h3 className='text-lg font-bold text-slate-900 dark:text-white sm:text-xl'>{policy.title}</h3>
                    <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>Cập nhật lần cuối: {policy.updated}</p>
                  </div>
                </div>
                <p className='mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200'>{policy.intro}</p>
                <div className='mt-5 space-y-5'>
                  {policy.sections.map(([heading, body]) => (
                    <div key={heading}>
                      <h4 className='font-semibold text-slate-800 dark:text-slate-100'>{heading}</h4>
                      <p className='mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-600 dark:text-slate-300'>{body}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <p className='border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400'>Việc chấp nhận được lưu trên thiết bị này. Nếu nội dung chính sách được cập nhật, ứng dụng có thể yêu cầu xác nhận lại.</p>
        </div>

        <footer className='flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:px-8'>
          <button type='button' onClick={onDecline} className='rounded-3xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>Từ chối</button>
          <div className='flex flex-col items-stretch gap-2 sm:items-end'>
            {!hasReachedEnd ? <p className='text-xs text-slate-500 dark:text-slate-400 sm:text-right'>Cuộn đến cuối nội dung để tiếp tục.</p> : <p className='flex items-center justify-end gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'><Check className='h-4 w-4' /> Đã xem hết nội dung</p>}
            <button type='button' disabled={!hasReachedEnd} onClick={onAccept} className='rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-accent-strong transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'>Chấp nhận</button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default LegalConsentModal;
