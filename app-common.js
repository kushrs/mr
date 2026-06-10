// app-common.js
// Shared utilities for auth navigation and offline support
(function () {
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  }

  function setAuthNav() {
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    const userNameEl = document.getElementById('username-display');
    const user = getCurrentUser();

    if (user) {
      if (loginLink) {
        loginLink.textContent = 'Profile';
        loginLink.href = 'profile.html';
      }
      if (logoutLink) {
        logoutLink.style.display = 'inline-block';
      }
      if (userNameEl) {
        userNameEl.textContent = `Hi, ${user.username || user.email}`;
      }
    } else {
      if (loginLink) {
        loginLink.textContent = 'Login';
        loginLink.href = 'login.html';
      }
      if (logoutLink) {
        logoutLink.style.display = 'none';
      }
      if (userNameEl) {
        userNameEl.textContent = '';
      }
    }
  }

  async function logout() {
    try {
      await window.supabaseClient?.auth.signOut();
    } catch (err) {
      console.error('Sign out error', err);
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('watchlist');
    location.href = 'login.html?logged_out=1';
  }

  function showToast(message, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.padding = '10px 15px';
      toast.style.borderRadius = '5px';
      toast.style.background = 'rgba(0,0,0,.8)';
      toast.style.color = '#fff';
      toast.style.zIndex = '9999';
      toast.style.fontSize = '0.9rem';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .2s ease';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
    }, 2500);
  }

  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service worker registered:', registration.scope);
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    }
  }

  async function syncWatchlistWithSupabase() {
    try {
      if (window.supabaseAvailable && window.supabaseClient) {
        const user = getCurrentUser();
        if (user) {
          const { data, error } = await window.supabaseClient
            .from('watchlist')
            .select('movie_id')
            .eq('user_id', user.id);
          
          if (!error && data) {
            const ids = data.map(item => item.movie_id.trim());
            localStorage.setItem('watchlist', JSON.stringify(ids));
            console.log("[app-common.js] Synced Supabase watchlist with localStorage:", ids);
          }
        }
      }
    } catch (e) {
      console.warn("[app-common.js] Watchlist sync failed:", e);
    }
  }

  window.CinePrime = {
    getCurrentUser,
    setAuthNav,
    logout,
    showToast,
    registerServiceWorker,
    syncWatchlistWithSupabase
  };

  document.addEventListener('DOMContentLoaded', async () => {
    setAuthNav();

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      });
    }

    registerServiceWorker();
    await syncWatchlistWithSupabase();
  });
})();