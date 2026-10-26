import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Check, ShieldCheck, X } from 'lucide-react';
import { policies } from '@/pages/LegalPoliciesPage';

const PolicyConsentModal = ({ open, onAccept, onDecline }) => {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const contentRef = useRef(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReachedEnd(false);
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const element = contentRef.current;
      if (element && element.scrollHeight <= element.clientHeight + 8) {
        setReachedEnd(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleScroll = () => {
    const element = contentRef.current;
    if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - 12) {
      setReachedEnd(true);
    }
  };

  if (!open) return null;

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-6' role='presentation'>
      <section role='dialog' aria-modal='true' aria-labelledby='policy-consent-title' className='flex h-[min(82dvh,680px)] max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-violet-300/40 bg-white shadow-accent-ring dark:border-violet-400/20 dark:bg-slate-900 dark:shadow-accent-ring'>
        <header className='flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7'>
          <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'><ShieldCheck className='h-5 w-5' /></span>
          <div className='min-w-0 flex-1'>
            <h2 id='policy-consent-title' className='text-lg font-bold text-slate-900 dark:text-white sm:text-xl'>{isVietnamese ? 'Vui lòng đọc các chính sách' : 'Please review the policies'}</h2>
            <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{isVietnamese ? 'Cuộn xuống hết nội dung để mở khóa nút Chấp nhận.' : 'Scroll to the end to enable Accept.'}</p>
          </div>
          <button type='button' onClick={onDecline} aria-label='Đóng cửa sổ' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'><X className='h-5 w-5' /></button>
        </header>

        <div ref={contentRef} onScroll={handleScroll} className='sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7'>
          <p className='mb-8 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100'>{isVietnamese ? <>Khi chọn <strong>Chấp nhận</strong>, bạn xác nhận đã đọc và đồng ý với Chính sách quyền riêng tư, Điều khoản sử dụng và Chính sách Cookie &amp; lưu trữ của Kaito Todo.</> : <>By selecting <strong>Accept</strong>, you confirm that you have read and agree to Kaito Todo's Privacy Policy, Terms of Use, and Cookie &amp; Storage Policy.</>}</p>
          {Object.entries(policies).map(([slug, policy]) => (
            <section key={slug} className='mb-9 last:mb-0'>
              <p className='text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300'>Kaito Todo · {isVietnamese ? 'Cập nhật' : 'Updated'} {policy.updated}</p>
              <h3 className='mt-2 text-xl font-bold text-slate-900 dark:text-white'>{policy.title}</h3>
              <p className='mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300'>{policy.intro}</p>
              <div className='mt-5 space-y-5'>
                {policy.sections.map(([heading, body]) => (
                  <div key={heading}>
                    <h4 className='font-semibold text-slate-800 dark:text-slate-100'>{heading}</h4>
                    <p className='mt-2 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300'>{body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className='mt-8 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400'>{isVietnamese ? 'Nếu không đồng ý, chọn Từ chối để quay lại biểu mẫu. Bạn có thể xem các bản chính sách công khai bất kỳ lúc nào từ liên kết trên trang đăng nhập hoặc trong Cài đặt.' : 'If you do not agree, select Decline to return to the form. You can review these public policies at any time from the links on the sign-in page or in Settings.'}</p>
        </div>

        <footer className='flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:px-7'>
          <p className='text-xs text-slate-500 dark:text-slate-400'>{reachedEnd ? (isVietnamese ? 'Đã đến cuối nội dung.' : 'You have reached the end.') : (isVietnamese ? 'Hãy cuộn đến cuối để tiếp tục.' : 'Scroll to the end to continue.')}</p>
          <div className='flex gap-3'>
            <button type='button' onClick={onDecline} className='flex-1 rounded-3xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none'><X className='mr-2 inline h-4 w-4' />{isVietnamese ? 'Từ chối' : 'Decline'}</button>
            <button type='button' onClick={onAccept} disabled={!reachedEnd} className='flex-1 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-strong transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:flex-none'><Check className='mr-2 inline h-4 w-4' />{isVietnamese ? 'Chấp nhận' : 'Accept'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default PolicyConsentModal;
