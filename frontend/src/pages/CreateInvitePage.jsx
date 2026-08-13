import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

// Tự động nhận diện môi trường:
// - Nếu chạy trên máy cá nhân (localhost) -> dùng cổng 5001
// - Nếu chạy trên web công khai -> dùng link Render
const BACKEND_URL = 
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001'
    : 'https://todo-app-1112.onrender.com';

const CreateInvitePage = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [invites, setInvites] = useState([]);

  // Hàm tải danh sách mã từ server
  const loadInvites = async (userId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/premium/invite/list?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error('Không thể tải danh sách mã:', err);
    }
  };

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('todo-user') || 'null');
    if (u?.isAdmin) {
      setIsAdmin(true);
      loadInvites(u._id);
    }
  }, []);

  const handleCreate = async () => {
    setMessage('');
    if (!code.trim()) return setMessage('Mã không được để trống');
    
    const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
    if (!user) return setMessage('Vui lòng đăng nhập!');

    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/premium/invite/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user._id, 
          code: code.trim(), 
          expiresInDays: Number(expiresInDays) 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi hệ thống');

      setMessage('Tạo mã thành công: ' + data.invite.code);
      setCode('');
      loadInvites(user._id); // Refresh bảng
    } catch (err) {
      setMessage(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Hàm xóa mã
  const handleDelete = async (inviteId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã này không?')) return;

    const user = JSON.parse(localStorage.getItem('todo-user') || 'null');
    if (!user) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/premium/invite/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, inviteId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi xóa');

      // Tải lại danh sách sau khi xóa thành công
      loadInvites(user._id);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className='p-6 text-center'>
        <h2 className='text-xl font-bold'>Quyền truy cập bị từ chối</h2>
        <p>Bạn không phải là quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <header className='flex justify-between items-center'>
        <h1 className='text-2xl font-bold'>Quản lý mã mời Premium</h1>
        <button onClick={() => navigate(-1)} className='px-4 py-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition'>Quay về</button>
      </header>

      {/* Form tạo mã */}
      <div className='bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4'>
        <input 
          value={code} onChange={(e) => setCode(e.target.value)} 
          placeholder='Nhập mã mời (vd: PRO-2026)' 
          className='w-full p-3 border rounded-xl bg-transparent' 
        />
        <input 
          type='number' value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} 
          className='w-full p-3 border rounded-xl bg-transparent' 
        />
        <button 
          onClick={handleCreate} disabled={processing}
          className='w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl disabled:opacity-50 font-medium transition'
        >
          {processing ? 'Đang tạo...' : 'Tạo mã mời'}
        </button>
        {message && <p className='text-sm font-medium text-blue-600'>{message}</p>}
      </div>

      {/* Bảng danh sách */}
      <div className='bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'>
        <h2 className='font-semibold mb-4 text-lg'>Danh sách mã</h2>
        <table className='w-full text-left border-collapse'>
          <thead>
            <tr className='text-sm text-slate-500 border-b border-slate-100 dark:border-slate-800'>
              <th className='p-3'>Mã</th>
              <th className='p-3'>Trạng thái</th>
              <th className='p-3'>Ngày tạo</th>
              <th className='p-3 text-right'>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan='4' className='p-4 text-center text-slate-400'>Chưa có mã mời nào.</td>
              </tr>
            ) : (
              invites.map((item) => (
                <tr key={item._id} className='border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'>
                  <td className='p-3 font-mono text-blue-600 font-medium'>{item.code}</td>
                  <td className='p-3'>
                    {item.redeemedBy?.length > 0 ? (
                      <span className='bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 text-xs px-2.5 py-1 rounded-md font-semibold'>Đã dùng</span>
                    ) : (
                      <span className='bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 text-xs px-2.5 py-1 rounded-md font-semibold'>Sẵn sàng</span>
                    )}
                  </td>
                  <td className='p-3 text-slate-500 text-sm'>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className='p-3 text-right'>
                    <button 
                      onClick={() => handleDelete(item._id)}
                      className='px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/50 dark:hover:bg-red-900 text-xs font-semibold rounded-lg transition'
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreateInvitePage;