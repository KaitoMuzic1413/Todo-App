import { useState } from 'react';
import { useNavigate } from 'react-router';

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

  // admin create invite
  const [newCode, setNewCode] = useState('');
  const [adminList, setAdminList] = useState([]);
  const handleCreateCode = async () => {
    if (!newCode.trim()) return;
    try {
      const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
      const res = await fetch('/api/premium/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, code: newCode.trim(), expiresInDays: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi');
      setMessage('Tạo mã thành công');
      setNewCode('');
    } catch (err) {
      setMessage(err.message || 'Lỗi tạo mã');
    }
  };

  return (
    <div className='space-y-6'>
      <header className='rounded-[16px] border border-slate-200/80 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70'>
        <h1 className='text-2xl font-bold'>Nâng cấp tài khoản</h1>
        <p className='mt-2 text-sm text-slate-500'>Chọn gói để nhận thêm lượt tạo task. (Thanh toán giả lập)</p>
      </header>

      <section className='grid gap-4 md:grid-cols-3'>
        {PLANS.map((plan) => (
          <div key={plan.id} className='rounded-2xl border p-4'>
            <img src='/Bank.jpg' alt='Bank' className='h-28 w-full object-cover rounded-md' />
            <h3 className='mt-3 text-lg font-semibold'>{plan.label}</h3>
            <p className='text-sm text-slate-500'>{plan.desc}</p>
            <p className='mt-2 font-medium'>{plan.priceVND.toLocaleString('vi-VN')} ₫</p>
            <div className='mt-3 flex gap-2'>
              <button
                type='button'
                onClick={() => setSelected(plan.id)}
                className={`rounded-full px-3 py-2 text-sm ${selected === plan.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Chọn
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={handlePurchase}
          disabled={!selected || processing}
          className={`rounded-2xl px-4 py-2 text-white ${!selected ? 'bg-slate-300' : 'bg-emerald-600'}`}
        >
          {processing ? 'Đang xử lý...' : 'Thanh toán (mô phỏng)'}
        </button>
        <button type='button' onClick={() => navigate('/')} className='rounded-2xl px-4 py-2 border'>Hủy</button>
      </div>

      {message ? <p className='mt-2 text-sm text-emerald-600'>{message}</p> : null}
    </div>
  );
};

export default PremiumPage;
