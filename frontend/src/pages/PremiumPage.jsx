import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { createInvite } from '@/lib/api';

const PLANS = [
  { id: 'weekly', label: '1$/week', desc: '+400 lượt', extra: 400, priceVND: 25000 },
  { id: 'monthly', label: '3$/month', desc: '+13.000 lượt', extra: 13000, priceVND: 75000 },
  { id: 'yearly', label: '30$/year', desc: 'Không giới hạn trong 1 năm', extra: 9999999, priceVND: 600000 },
];

const PremiumPage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
const [showPurchaseModal, setShowPurchaseModal] = useState(false);

const handlePurchase = async () => {
  if (!selected) return;
  setProcessing(true);
  setMessage('');

  await new Promise((r) => setTimeout(r, 1200));

  const now = Date.now();
  const plan = PLANS.find((p) => p.id === selected);
  const premium = {
    purchasedAt: now,
    extraQuota: plan.extra,
    expiresAt: now + 1000 * 60 * 60 * 24 * 30, // 30 days for demo
  };

  // Save via backend ideally — for now, store and keep UI updated
  localStorage.setItem('todo-premium', JSON.stringify(premium));
  setProcessing(false);
  setMessage('Thanh toán mô phỏng thành công. Quota đã được cập nhật.');

  setTimeout(() => navigate('/'), 1200);
};

const [inviteCode, setInviteCode] = useState('');
const [adminMode, setAdminMode] = useState(false);
const [createCode, setCreateCode] = useState('');
const [createExpires, setCreateExpires] = useState(30);
const [adminMessage, setAdminMessage] = useState('');

useEffect(() => {
  try {
    const u = JSON.parse(localStorage.getItem('todo-user') || 'null');
    setAdminMode(!!u?.isAdmin);
  } catch (e) {
    setAdminMode(false);
  }
}, []);

const handleCreateInvite = async () => {
  if (!createCode.trim()) return setAdminMessage('Mã không được rỗng');
  setAdminMessage('');
  try {
    const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
    const res = await createInvite(user._id, createCode.trim(), Number(createExpires || 30));
    setAdminMessage('Tạo mã thành công: ' + res.data.invite.code);
    setCreateCode('');
  } catch (err) {
    console.error(err);
    setAdminMessage(err?.response?.data?.message || 'Lỗi khi tạo mã');
  }
};

const handleRedeem = async () => {
  if (!inviteCode.trim()) return;
  setProcessing(true);
  try {
    const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
    if (!user?._id) throw new Error('Bạn cần đăng nhập để nhập mã mời');
    const res = await fetch('/api/premium/invite/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id, code: inviteCode.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Lỗi');
    setMessage('Mã mời áp dụng thành công. Bạn nhận được premium 1 tháng.');
    // refresh local user premium
    const stored = JSON.parse(localStorage.getItem('todo-user') || 'null');
    if (stored) stored.premium = data.premium || stored.premium;
    localStorage.setItem('todo-user', JSON.stringify(stored));
  } catch (err) {
    setMessage(err.message || 'Lỗi khi áp dụng mã');
  } finally {
    setProcessing(false);
  }
};


  return (
    <div className='space-y-6'>
      <header className='rounded-[16px] border border-slate-200/80 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70 flex items-start justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Nâng cấp tài khoản</h1>
          <p className='mt-2 text-sm text-slate-500'>Chọn gói để nhận thêm lượt tạo task. (Thanh toán giả lập)</p>
        </div>
        <div className='ml-4 flex-shrink-0'>
          <button
            type='button'
            onClick={() => navigate('/')}
            className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          >
            Quay về
          </button>
        </div>
      </header>

      <section className='grid gap-4 md:grid-cols-3'>
        {PLANS.map((plan) => (
          <div key={plan.id} className='rounded-2xl border p-4'>
            <h3 className='mt-1 text-lg font-semibold'>{plan.label}</h3>
            <p className='text-sm text-slate-500'>{plan.desc}</p>
            <p className='mt-2 font-medium'>{plan.priceVND.toLocaleString('vi-VN')} ₫</p>
            <div className='mt-3 flex gap-2'>
              <button
                type='button'
                onClick={() => { setSelected(plan.id); setShowPurchaseModal(true); }}
                className={`rounded-full px-3 py-2 text-sm ${selected === plan.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Chọn
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className='mt-6 space-y-4'>
        {adminMode ? (
          <div className='rounded-2xl border p-4'>
            <h4 className='mb-2 font-medium'>Tạo mã mời (Admin)</h4>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <input value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder='Mã (ví dụ: INVITE-ABC-123)' className='flex-1 rounded-2xl border px-3 py-2' />
              <input type='number' value={createExpires} onChange={(e) => setCreateExpires(e.target.value)} className='w-28 rounded-2xl border px-3 py-2' />
              <button onClick={handleCreateInvite} disabled={processing} className='rounded-2xl bg-blue-600 px-4 py-2 text-white'>Tạo mã</button>
            </div>
            {adminMessage ? <p className='mt-2 text-sm text-slate-600'>{adminMessage}</p> : null}
          </div>
        ) : null}

        <div className='rounded-2xl border p-4'>
          <h4 className='mb-2 font-medium'>Nhập mã mời</h4>
          <div className='flex gap-2'>
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder='Nhập mã mời' className='flex-1 rounded-2xl border px-3 py-2' />
            <button onClick={handleRedeem} disabled={processing || !inviteCode.trim()} className='rounded-2xl bg-emerald-600 px-4 py-2 text-white'>Áp dụng</button>
          </div>
        </div>

      </div>

      {showPurchaseModal ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900'>
            <button className='absolute right-3 top-3 rounded-full p-1' onClick={() => setShowPurchaseModal(false)} aria-label='Close'>
              Đóng
            </button>
            <img src='/Bank.jpg' alt='Bank' className='mx-auto mb-4 w-full h-auto max-h-56 object-contain rounded-md' />
            <h3 className='text-lg font-semibold mb-2'>Bạn chọn: {PLANS.find(p => p.id === selected)?.label}</h3>
            <p className='text-sm text-slate-500 mb-4'>{PLANS.find(p => p.id === selected)?.desc}</p>
            <div className='flex justify-end gap-3'>
              <button onClick={() => { setShowPurchaseModal(false); setSelected(null); }} className='rounded-2xl px-4 py-2 border'>Hủy</button>
              <button onClick={async () => { await handlePurchase(); setShowPurchaseModal(false); }} disabled={!selected || processing} className='rounded-2xl bg-emerald-600 px-4 py-2 text-white'>{processing ? 'Đang xử lý...' : 'Xác nhận thanh toán'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className='mt-2 text-sm text-emerald-600'>{message}</p> : null}
    </div>
  );
};

export default PremiumPage;
