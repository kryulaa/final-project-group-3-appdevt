import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Game from './Game'; // Import the new Game Component

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('login'); 

  // Form State
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // --- TOAST HELPER ---
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const switchView = (newView) => {
    setView(newView);
    setToast({ show: false, message: '', type: '' });
  };

  // --- AUTH & SESSION HANDLING ---
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) document.body.classList.add('game-active');
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        document.body.classList.add('game-active');
      } else {
        document.body.classList.remove('game-active');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) return showToast('Enter email and password.', 'error');
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(loginData);
    setLoading(false);

    if (error) showToast(error.message, 'error');
  };

  const handleRegister = async () => {
    const { username, email, password, confirmPassword } = registerData;
    if (!username || !email || !password) return showToast('Fill all fields.', 'error');
    if (password !== confirmPassword) return showToast('Passwords do not match.', 'error');

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }, // Trigger SQL to create Profile + Player
    });
    setLoading(false);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Success! Check your email.', 'success');
      setRegisterData({ username: '', email: '', password: '', confirmPassword: '' });
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail) return showToast('Enter email address.', 'error');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail);
    setLoading(false);
    if (error) showToast(error.message, 'error');
    else showToast('Reset link sent!', 'success');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // --- RENDER GAME IF LOGGED IN ---
  if (session) {
    return (
      <>
        {/* Logout Button overlay */}
        <div style={{position: 'absolute', top: 10, right: 10, zIndex: 100}}>
           <button className="btn" style={{background: '#ff7b7b', color: 'white', padding: '8px 15px'}} onClick={handleLogout}>Logout</button>
        </div>
        
        {/* THE REACT GAME COMPONENT */}
        <Game session={session} />
      </>
    );
  }

  // --- RENDER LOGIN FORMS ---
  return (
    <div className="overlay">
      {toast.show && (
        <div className="toast-container">
            <div className={`toast ${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="game-container">
        {/* LOGIN */}
        {view === 'login' && (
          <div id="login-form">
            <div className="game-header">
              <h1 className="game-title">Chiikawa</h1>
              <p className="game-subtitle">Join the adventure!</p>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
            </div>
            <div className="forgot-password">
              <a href="#" onClick={(e) => { e.preventDefault(); switchView('forgot'); }}>Forgot Password?</a>
            </div>
            <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>{loading ? '...' : 'Login'}</button>
            <div className="form-toggle">
              New? <a href="#" onClick={(e) => { e.preventDefault(); switchView('register'); }}>Create Account</a>
            </div>
          </div>
        )}

        {/* REGISTER */}
        {view === 'register' && (
          <div id="register-form">
            <div className="game-header"><h1 className="game-title">Sign Up</h1></div>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}/>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}/>
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}/>
            </div>
            <div className="form-group">
              <label>Confirm</label>
              <input type="password" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}/>
            </div>
            <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>{loading ? '...' : 'Start'}</button>
            <div className="form-toggle">
              Have account? <a href="#" onClick={(e) => { e.preventDefault(); switchView('login'); }}>Login</a>
            </div>
          </div>
        )}

        {/* FORGOT */}
        {view === 'forgot' && (
          <div id="forgot-password-form">
             <div className="game-header"><h1 className="game-title">Reset</h1></div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleForgot} disabled={loading}>{loading ? '...' : 'Send Link'}</button>
            <div className="form-toggle">
              <a href="#" onClick={(e) => { e.preventDefault(); switchView('login'); }}>Back to Login</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}