import { useEffect, useState } from 'react';

export const translations = {
  en: {
    appName: 'Todo App',
    productivityHub: 'Productivity hub',
    home: 'Home',
    premium: 'Premium',
    contact: 'Contact',
    trash: 'Trash',
    language: 'Language',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    searchTask: 'Search task',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    signedIn: 'Signed in',
    signOut: 'Out',
    emailAddress: 'Email address',
    invalidEmail: 'Please enter a valid email address.',
    signInWithEmail: 'Sign in with email',
    signingIn: 'Signing in...',
    addNewTask: 'Add a new task',
    newTask: 'New Task',
    noTasks: 'No tasks yet. Add your first task above.',
    todayTasks: "Today's tasks",
    manage: 'Manage',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    completed: 'Completed',
    pending: 'Pending',
    important: 'Important',
    total: 'Total',
    totalTasks: 'Total tasks',
    allTasks: 'All tasks',
    today: 'Today',
    thisWeek: 'This week',
    thisMonth: 'This month',
    all: 'All',
    allTime: 'All time',
    page: 'Page',
    of: 'of',
    goToPage: 'Go',
    enterPageError: 'Please enter a page number.',
    invalidPageRangeError: 'Please enter a page between 1 and {max}.',
    noTasksInTrash: 'No tasks in trash.',
    restore: 'Restore',
    deletePermanently: 'Delete permanently',
    clearAllTrash: 'Clear all trash',
    status: 'Status',
    statusCompleted: 'Completed',
    statusPending: 'Pending',
    trashTitle: 'Trash',
    contactPhone: 'Phone',
    contactEmail: 'Email',
    contactFacebook: 'Facebook',
    aboutTitle: 'Stay connected with Redhat',
    aboutSubtitle: 'About us',
    welcome: 'Welcome',
    signInIntro: 'Sign in with your email to continue to your tasks.',
    signIn: 'Sign in',
    notFoundTitle: 'The page you are looking for does not exist.',
    backToHome: 'Back to home',
    taskDeletedToTrash: 'Task moved to trash successfully',

    createdAt: 'Created at',
    deletedAt: 'Deleted at',
    quickRemove: 'Quick remove',
    quickRemoveTrash: 'Quick select',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    deleteSelected: 'Delete selected',
    period: 'Time period',
  },
  vi: {
    appName: 'Todo App',
    productivityHub: 'Trung tâm làm việc',
    home: 'Trang chủ',
    premium: 'Premium',
    contact: 'Liên hệ',
    trash: 'Thùng rác',
    language: 'Ngôn ngữ',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    searchTask: 'Tìm kiếm task',
    darkMode: 'Chế độ tối',
    lightMode: 'Chế độ sáng',
    signedIn: 'Đã đăng nhập',
    signOut: 'Đăng xuất',
    emailAddress: 'Địa chỉ email',
    invalidEmail: 'Vui lòng nhập email hợp lệ.',
    signInWithEmail: 'Đăng nhập bằng email',
    signingIn: 'Đang đăng nhập...',
    addNewTask: 'Thêm task mới',
    newTask: 'Task mới',
    noTasks: 'Chưa có task nào. Hãy thêm task đầu tiên ở trên.',
    todayTasks: 'Task hôm nay',
    manage: 'Quản lý',
    save: 'Lưu',
    cancel: 'Huỷ',
    edit: 'Sửa',
    completed: 'Đã hoàn thành',
    pending: 'Chưa hoàn thành',
    important: 'Quan trọng',
    total: 'Tổng số',
    totalTasks: 'Tổng task',
    allTasks: 'Tất cả',
    today: 'Hôm nay',
    thisWeek: 'Tuần này',
    thisMonth: 'Tháng này',
    all: 'Tất cả',
    allTime: 'Tất cả thời gian',
    page: 'Trang',
    of: 'trong',
    goToPage: 'Đi',
    enterPageError: 'Vui lòng nhập số trang.',
    invalidPageRangeError: 'Vui lòng nhập số trang từ 1 đến {max}.',
    noTasksInTrash: 'Không có task nào trong thùng rác.',
    restore: 'Khôi phục',
    deletePermanently: 'Xoá vĩnh viễn',
    clearAllTrash: 'Xoá hết thùng rác',
    status: 'Trạng thái',
    statusCompleted: 'Đã hoàn thành',
    statusPending: 'Chưa hoàn thành',
    trashTitle: 'Thùng rác',
    contactPhone: 'Số điện thoại',
    contactEmail: 'Email',
    contactFacebook: 'Facebook',
    aboutTitle: 'Luôn kết nối với Redhat',
    aboutSubtitle: 'Về chúng tôi',
    welcome: 'Chào mừng',
    signInIntro: 'Đăng nhập bằng email để tiếp tục với task của bạn.',
    signIn: 'Đăng nhập',
    notFoundTitle: 'Trang bạn tìm kiếm không tồn tại.',
    backToHome: 'Quay lại trang chủ',
    taskDeletedToTrash: 'Task đã được chuyển vào thùng rác',

    createdAt: 'Tạo lúc',
    deletedAt: 'Xóa lúc',
    quickRemove: 'Xóa nhanh',
    quickRemoveTrash: "Chọn nhanh",
    selectAll: 'Chọn tất cả',
    deselectAll: 'Bỏ chọn tất cả',
    deleteSelected: 'Xóa đã chọn',
    period: 'Khoảng thời gian',
  },
};

export const getLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem('todo-language') || 'en';
};

export const setLanguage = (language) => {
  if (typeof window === 'undefined') return;
  const nextLanguage = language === 'vi' ? 'vi' : 'en';
  localStorage.setItem('todo-language', nextLanguage);
  window.dispatchEvent(new Event('todo-language-changed'));
};

export const useLanguage = () => {
  const [language, setLanguageState] = useState(getLanguage);

  useEffect(() => {
    const syncLanguage = () => setLanguageState(getLanguage());
    window.addEventListener('todo-language-changed', syncLanguage);
    return () => window.removeEventListener('todo-language-changed', syncLanguage);
  }, []);

  // Hàm hỗ trợ format chuỗi dịch có chứa tham số (Ví dụ: {max})
  const formatText = (key, params = {}) => {
    const text = translations[language]?.[key] || translations.en[key] || key;
    return Object.keys(params).reduce(
      (acc, paramKey) => acc.replace(`{${paramKey}}`, params[paramKey]),
      text
    );
  };

  return {
    language,
    setLanguage,
    t: translations[language] || translations.en,
    formatText,
  };
};