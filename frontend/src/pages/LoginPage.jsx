import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

function LoginPage() {
  const navigate = useNavigate();

  // State quản lý hiệu ứng trượt giữa Sign In và Sign Up (tương ứng với class 'active')
  const [isSignUpActive, setIsSignUpActive] = useState(false);

  // State quản lý hiển thị mật khẩu
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // State quản lý Toast thông báo
  const [toast, setToast] = useState({ message: '', type: '', show: false });

  // State lưu giá trị các input form Sign Up
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });
  const [signupErrors, setSignupErrors] = useState({ name: '', email: '', password: '' });

  // State lưu giá trị các input form Sign In
  const [signinData, setSigninData] = useState({ email: '', password: '' });
  const [signinErrors, setSigninErrors] = useState({ email: '', password: '' });

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Hiển thị Toast
  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // Xử lý khi Submit form Sign Up
  const handleSignupSubmit = (e) => {
    e.preventDefault();
    let isValid = true;
    let errors = { name: '', email: '', password: '' };

    if (!signupData.name.trim()) {
      errors.name = 'This field is required.';
      isValid = false;
    }
    if (!signupData.email.trim()) {
      errors.email = 'This field is required.';
      isValid = false;
    } else if (!EMAIL_REGEX.test(signupData.email)) {
      errors.email = 'Please enter a valid email address.';
      isValid = false;
    }
    if (!signupData.password.trim()) {
      errors.password = 'This field is required.';
      isValid = false;
    } else if (signupData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
      isValid = false;
    }

    setSignupErrors(errors);

    if (!isValid) {
      showToastMessage('Please fix the errors below.', 'error');
      return;
    }

    showToastMessage('Account created successfully!', 'success');
    setSignupData({ name: '', email: '', password: '' });
  };

  // Xử lý khi Submit form Sign In
  const handleSigninSubmit = (e) => {
    e.preventDefault();
    let isValid = true;
    let errors = { email: '', password: '' };

    if (!signinData.email.trim()) {
      errors.email = 'This field is required.';
      isValid = false;
    } else if (!EMAIL_REGEX.test(signinData.email)) {
      errors.email = 'Please enter a valid email address.';
      isValid = false;
    }
    if (!signinData.password.trim()) {
      errors.password = 'This field is required.';
      isValid = false;
    }

    setSigninErrors(errors);

    if (!isValid) {
      showToastMessage('Please fix the errors below.', 'error');
      return;
    }

    showToastMessage('Signed in successfully!', 'success');
    setSigninData({ email: '', password: '' });
    
    // Ví dụ: Đăng nhập thành công thì chuyển hướng về trang chủ '/'
    // navigate('/');
  };

  return (
    <div className="login-page-wrapper">
      {/* Background/Premium box nếu có */}
      <div className="premium-box">
        <span className="text hello">Hello!</span>
        <span className="text premium">It's Premium!</span>
      </div>

      <div className={`container ${isSignUpActive ? 'active' : ''}`} id="container">
        
        {/* FORM SIGN UP */}
        <div className="form-container sign-up">
          <form onSubmit={handleSignupSubmit} noValidate>
            <h1>Create Account</h1>
            <div className="social-icons">
              <a href="#" className="icon" aria-label="Sign in with Google">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </a>
              <a href="#" className="icon" aria-label="Sign in with Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="icon" aria-label="Sign in with GitHub">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </a>
              <a href="#" className="icon" aria-label="Sign in with LinkedIn">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <span>or use your email for registration</span>

            <div className="field-group">
              <label htmlFor="signup-name" className="sr-only">Full Name</label>
              <input 
                type="text" 
                id="signup-name" 
                placeholder="Full Name" 
                value={signupData.name}
                onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                required 
              />
              <span className="field-error">{signupErrors.name}</span>
            </div>

            <div className="field-group">
              <label htmlFor="signup-email" className="sr-only">Email</label>
              <input 
                type="email" 
                id="signup-email" 
                placeholder="Email" 
                value={signupData.email}
                onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                required 
              />
              <span className="field-error">{signupErrors.email}</span>
            </div>

            <div className="field-group">
              <label htmlFor="signup-password" className="sr-only">Password</label>
              <div className="password-wrapper">
                <input 
                  type={showSignupPassword ? "text" : "password"} 
                  id="signup-password" 
                  placeholder="Password (min 8 chars)" 
                  value={signupData.password}
                  onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                  required 
                />
                <button 
                  type="button" 
                  className="toggle-pw" 
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                >
                  <i className={`fa-regular ${showSignupPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <span className="field-error">{signupErrors.password}</span>
            </div>

            <button type="submit">Sign Up</button>
            <p className="mobile-switch">
              Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUpActive(false); }}>Sign In</a>
            </p>
          </form>
        </div>

        {/* FORM SIGN IN */}
        <div className="form-container sign-in">
          <form onSubmit={handleSigninSubmit} noValidate>
            <h1>Sign In</h1>
            <div className="social-icons">
              {/* Giữ nguyên các icon mạng xã hội giống như trên */}
              <a href="#" className="icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg></a>
            </div>
            <span>or use your email and password</span>

            <div className="field-group">
              <label htmlFor="signin-email" className="sr-only">Email</label>
              <input 
                type="email" 
                id="signin-email" 
                placeholder="Email" 
                value={signinData.email}
                onChange={(e) => setSigninData({...signinData, email: e.target.value})}
                required 
              />
              <span className="field-error">{signinErrors.email}</span>
            </div>

            <div className="field-group">
              <label htmlFor="signin-password" className="sr-only">Password</label>
              <div className="password-wrapper">
                <input 
                  type={showSigninPassword ? "text" : "password"} 
                  id="signin-password" 
                  placeholder="Password" 
                  value={signinData.password}
                  onChange={(e) => setSigninData({...signinData, password: e.target.value})}
                  required 
                />
                <button 
                  type="button" 
                  className="toggle-pw" 
                  onClick={() => setShowSigninPassword(!showSigninPassword)}
                >
                  <i className={`fa-regular ${showSigninPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <span className="field-error">{signinErrors.password}</span>
            </div>

            <a href="#">Forgot your password?</a>
            <button type="submit">Sign In</button>
            <p className="mobile-switch">
              Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUpActive(true); }}>Sign Up</a>
            </p>
          </form>
        </div>

        {/* TOGGLE PANEL (Hiệu ứng trượt qua lại) */}
        <div className="toggle-container" aria-hidden="true">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Enter your personal details to use all of our features</p>
              <button className="hidden" id="login" type="button" onClick={() => setIsSignUpActive(false)}>Sign In</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to use all of our features</p>
              <button className="hidden" id="register" type="button" onClick={() => setIsSignUpActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>

      {/* Toast Component */}
      <div id="toast" className={`toast ${toast.type} ${toast.show ? 'show' : ''}`} role="alert">
        {toast.message}
      </div>
    </div>
  );
}

export default LoginPage;