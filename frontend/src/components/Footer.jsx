const Footer = () => {
  return (
    <footer className='flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300 sm:flex-row'>
      <p>Made with focus for a better day.</p>
      <p>&copy; 2026 Redhat Todo App</p>
    </footer>
  );
};

export default Footer;