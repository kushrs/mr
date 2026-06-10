/* ======================
SUPABASE CONFIG
====================== */

const supabaseClient = window.supabaseClient;

/* ======================
REGISTER
====================== */

const registerForm = document.getElementById("register-form");

if (registerForm) {

registerForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  // Check if Supabase is available
  if (!window.supabaseAvailable) {
    showFormError(registerForm, 'Authentication service is currently unavailable. Please try again later.');
    return;
  }

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  if (!validateEmail(email)) {
    showFormError(registerForm, 'Please enter a valid email.');
    return;
  }
  if (!validatePassword(password)) {
    showFormError(registerForm, 'Password must be at least 8 characters long.');
    return;
  }

  const submitBtn = registerForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (error) {
      // Check if it's a 403 error
      if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.status === 403) {
        showFormError(registerForm, 'Authentication service is currently unavailable. Please try again later.');
        window.supabaseAvailable = false;
      } else {
        showFormError(registerForm, error.message || 'Registration failed.');
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // Ensure user has a profile and local storage updated
    try {
      let user = data.user;

      // If signUp doesn't return a user (common when email confirmation is required), fetch it
      if (!user) {
        const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (!signInErr && signInData && signInData.user) {
          user = signInData.user;
        }
      }

      if (user) {
        console.log("Register: creating/updating profile for", user.id);
        await ensureProfile(user);
        await storeLocalUser(user);
        console.log("Register: profile created and stored locally");
      }
    } catch (profileError) {
      console.error('Could not create profile:', profileError);
      alert('Registration completed, but profile creation failed. Check console for details.');
    }

    window.CinePrime?.showToast("Registration successful! Redirecting...");
    window.location.href = "profile.html";
  } catch (err) {
    console.error('Registration error:', err);
    showFormError(registerForm, 'Network error. Please check your connection and try again.');
    if (submitBtn) submitBtn.disabled = false;
  }

});

}


/* ======================
LOGIN
====================== */

const loginForm = document.getElementById("login-form");

if (loginForm) {

loginForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  // Check if Supabase is available
  if (!window.supabaseAvailable) {
    showFormError(loginForm, 'Authentication service is currently unavailable. Please try again later.');
    return;
  }

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  if (!validateEmail(email)) {
    showFormError(loginForm, 'Please enter a valid email.');
    return;
  }
  if (!validatePassword(password)) {
    showFormError(loginForm, 'Password must be at least 8 characters long.');
    return;
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      // Check if it's a 403 error
      if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.status === 403) {
        showFormError(loginForm, 'Authentication service is currently unavailable. Please try again later.');
        window.supabaseAvailable = false;
      } else {
        showFormError(loginForm, error.message || 'Login failed.');
      }
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // Ensure profile record and local user storage
    if (data && data.user) {
      try {
        await ensureProfile(data.user);
        await storeLocalUser(data.user);
      } catch (error) {
        console.warn('Could not ensure profile on login:', error);
      }
    }

    window.CinePrime?.showToast("Login successful. Redirecting...");
    window.location.href = "profile.html";
  } catch (err) {
    console.error('Login error:', err);
    showFormError(loginForm, 'Network error. Please check your connection and try again.');
    if (submitBtn) submitBtn.disabled = false;
  }

});

}


/* ======================
GOOGLE LOGIN
====================== */

const googleBtn = document.getElementById("google-login-btn");

if (googleBtn) {

googleBtn.onclick = async () => {

await supabaseClient.auth.signInWithOAuth({
provider: "google",
options: {
redirectTo: window.location.origin
}
});

};

}


/* ======================
LOGOUT
====================== */

function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function showFormError(form, message) {
  const errorEl = form.querySelector('.form-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } else {
    alert(message);
  }
}

async function logout(){
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('Supabase signout error:', err);
  }
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
  // Set flag in sessionStorage to prevent auto-redirect on next page
  sessionStorage.setItem('justLoggedOut', 'true');
  window.location.href = "login.html?logged_out=1";
}


/* ======================
PROFILE HELPERS
====================== */

async function storeLocalUser(user) {
  if (!user) return;

  const username = user.email ? user.email.split('@')[0] : '';
  const fullName = user.user_metadata?.full_name || username;
  const storedUser = {
    id: user.id,
    email: user.email,
    username,
    fullname: fullName,
    createdAt: new Date().toISOString(),
    picture: user.user_metadata?.avatar_url || null
  };

  localStorage.setItem('currentUser', JSON.stringify(storedUser));

  const users = JSON.parse(localStorage.getItem('users')) || [];
  const existingIndex = users.findIndex(u => u.id === storedUser.id);
  if (existingIndex === -1) {
    users.push(storedUser);
  } else {
    users[existingIndex] = { ...users[existingIndex], ...storedUser };
  }
  localStorage.setItem('users', JSON.stringify(users));
}

async function ensureProfile(user) {
  if (!user) return;

  const username = user.email ? user.email.split('@')[0] : '';
  const profile = {
    id: user.id,
    email: user.email,
    username,
    full_name: user.user_metadata?.full_name || username,
    avatar_url: user.user_metadata?.avatar_url || null
  };

  console.log("Upserting profile:", profile);
  const { error } = await supabaseClient
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });

  if (error) {
    console.warn('Failed to upsert profile:', error);
    throw error;
  }
  console.log('Profile upsert succeeded');
}

async function checkUser(){
  // FIX: If user just logged out, they landed here intentionally.
  // Don't check the (still-briefly-active) session and redirect them back.
  const params = new URLSearchParams(window.location.search);
  const justLoggedOut = sessionStorage.getItem('justLoggedOut') === 'true';
  
  if (params.get('logged_out') === '1' || justLoggedOut) {
    console.log('User just logged out - skipping auth check completely');
    // Clean the flag from the URL bar without triggering a reload
    window.history.replaceState({}, '', window.location.pathname);
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('justLoggedOut');
    return; // Stop — do not check Supabase session
  }

  console.log('checkUser() called');

  // Check if Supabase is available
  if (!window.supabaseAvailable) {
    console.log('Supabase not available, skipping auth check');
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    return;
  }

  try {
    const { data } = await supabaseClient.auth.getUser();
    console.log('checkUser got user data:', data.user ? 'user found' : 'no user');

    if(data.user){
      console.log("Logged in user:", data.user.email);
      await ensureProfile(data.user).catch(() => {});
      await storeLocalUser(data.user);

      // Auto-redirect only when user lands on auth pages while already logged in
      const path = window.location.pathname;
      console.log('Current path:', path);
      if (path.endsWith('login.html') || path.endsWith('register.html') || path.endsWith('google-callback.html')) {
        console.log('Redirecting to profile.html');
        window.location.href = 'profile.html';
      }
    } else {
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
    }
  } catch (error) {
    console.warn('Error checking user auth:', error);

    // Check if it's a 403 Forbidden error (project suspended/invalid key)
    if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.status === 403) {
      console.warn('Supabase 403 error detected - marking service as unavailable');
      window.supabaseAvailable = false;
      window.supabaseError = error;
      if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
        setTimeout(() => {
          alert('Authentication service is currently unavailable (project may be suspended). The app will work in offline mode for movie browsing.');
        }, 1000);
      }
    }

    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
  }
}

// Delay checkUser execution to allow Supabase session to fully clear
setTimeout(() => {
  checkUser();
}, 500);