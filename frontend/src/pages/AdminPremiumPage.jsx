import { useState } from 'react';
import { useNavigate } from 'react-router';

const AdminPremiumPage = () => {
  const [code, setCode] = useState('');
  const user = JSON.parse(localStorage.getItem('todo-user'));

  const handleCreate = async () => {
    // Kiểm tra email ngay tại client
    if (user?.email !== 'kaitomuzicvn@gmail.com') {
      alert("Bạn không có quyền!");
      return;
    }

    const res = await fetch('/api/premium/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: user.email, code, expiresInDays: 30 })
    });
    
    if (res.ok) alert("Tạo mã thành công!");
    else alert("Lỗi tạo mã!");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Admin: Tạo mã mời Premium</h1>
      <input 
        className="border p-2 mt-4 block"
        placeholder="Nhập mã (VD: VIP2026)" 
        value={code} 
        onChange={(e) => setCode(e.target.value)} 
      />
      <button className="bg-blue-500 text-white p-2 mt-2" onClick={handleCreate}>
        Tạo mã
      </button>
    </div>
  );
};
export default AdminPremiumPage;