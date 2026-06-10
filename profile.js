// Supabase setup from shared supabase-config.js
const supabaseClient = window.supabaseClient;

const API_KEY = window.OMDB_API_KEY || "8ddfd56d"; // Same API key as other pages

document.addEventListener("DOMContentLoaded", async () => {
  // Check if user is logged in
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  if (!currentUser) {
    // Redirect to login page if not logged in
    window.location.href = "login.html";
    return;
  }
  
  // Set up theme toggle
  setupThemeToggle();
  
  // Load user data
  await loadUserProfile(currentUser);
  
  // Set up tab navigation
  setupTabs();
  
  // Set up form submission
  document.getElementById("profile-form").addEventListener("submit", updateProfile);
  
  // Set up password strength meter
  const newPasswordInput = document.getElementById("new-password");
  if (newPasswordInput) {
    newPasswordInput.addEventListener("input", updatePasswordStrength);
  }
  
  // Set up password confirmation match
  const confirmPasswordInput = document.getElementById("confirm-password");
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener("input", checkPasswordMatch);
  }
  
  // Set up profile picture change
  document.getElementById("change-picture-btn").addEventListener("click", () => {
    document.getElementById("picture-upload").click();
  });
  
  document.getElementById("picture-upload").addEventListener("change", handleProfilePictureUpload);
  
  // Set up preferences save
  document.getElementById("save-preferences").addEventListener("click", savePreferences);
  
  // Load user activity
  loadRecentlyViewed();
  loadUserRatings();
  loadUserComments();
  
  // Load user preferences
  loadUserPreferences();
  
  // Add logout button logic with debugging
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        // Sign out from Supabase
        await supabaseClient.auth.signOut();
      } catch (error) {
        console.error('Supabase signout error:', error);
      }
      // Clear user data
      localStorage.removeItem("currentUser");
      sessionStorage.removeItem("currentUser");
      // Set flag to prevent auto-redirect
      sessionStorage.setItem('justLoggedOut', 'true');
      // Redirect with logged_out flag
      window.location.href = "login.html?logged_out=1";
    });
  }
});

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.textContent = '☀️';
  }
  
  // Theme toggle button event listener
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    
    if (document.body.classList.contains('light-theme')) {
      localStorage.setItem('theme', 'light');
      themeToggle.textContent = '☀️';
    } else {
      localStorage.setItem('theme', 'dark');
      themeToggle.textContent = '🌙';
    }
  });
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(content => {
        content.classList.remove("active");
        content.style.opacity = 0;
      });
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      const tab = document.getElementById(`${tabId}-tab`);
      tab.classList.add("active");
      setTimeout(() => { tab.style.opacity = 1; }, 50);
    });
  });
}

async function loadUserProfile(user) {
  // Load user profile from Supabase (if available)
  let profileData = user;
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!error && profile) {
      profileData = { ...user, ...profile };
    }
  } catch (err) {
    console.warn('Failed to load profile from Supabase:', err);
  }

  // Set profile picture or initials
  const profilePicture = document.getElementById("profile-picture");
  const imageUrl = profileData.avatar_url || profileData.picture;
  const displayName = profileData.full_name || profileData.fullname || profileData.username || profileData.email || '';

  if (imageUrl) {
    profilePicture.innerHTML = `<img src="${imageUrl}" alt="${displayName}">`;
  } else {
    const initials = displayName.charAt(0)?.toUpperCase() || '';
    profilePicture.innerHTML = `<div class="profile-initial">${initials}</div>`;
  }

  // Set profile info
  document.getElementById("profile-name").textContent = displayName;
  document.getElementById("profile-email").textContent = profileData.email || '';

  // Format joined date
  const joinedDate = profileData.created_at ? new Date(profileData.created_at) : new Date();
  document.getElementById("profile-joined").textContent = `Member since: ${joinedDate.toLocaleDateString()}`;

  // Fill form fields
  document.getElementById("fullname").value = profileData.full_name || profileData.fullname || displayName;
  document.getElementById("username").value = profileData.username || '';
  document.getElementById("email").value = profileData.email || '';
}

function showLoadingButton(btn, loading = true) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || 'Save Changes';
  }
}

function animateMessage(element, message, isError = true) {
  if (!element) return;
  element.textContent = message;
  element.style.opacity = 0;
  element.style.transition = 'opacity 0.4s';
  element.style.color = isError ? '#ff4d4d' : '#28a745';
  setTimeout(() => { element.style.opacity = 1; }, 50);
  setTimeout(() => { element.style.opacity = 0; }, 3000);
}

async function updateProfile(e) {
  e.preventDefault();
  const fullname = document.getElementById("fullname").value.trim();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const errorMessage = document.getElementById("error-message");
  const btn = e.target.querySelector("button[type='submit']");
  if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;

  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) {
    animateMessage(errorMessage, "No logged in user found");
    return;
  }

  showLoadingButton(btn, true);

  // Validate username uniqueness
  if (username) {
    const { data: existingUser, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', currentUser.id)
      .maybeSingle();

    if (checkError) {
      console.warn('Username uniqueness check failed:', checkError);
    }
    if (existingUser) {
      animateMessage(errorMessage, 'Username already taken');
      showLoadingButton(btn, false);
      return;
    }
  }

  // Update profile record
  const profileUpdates = {
    updated_at: new Date().toISOString(),
    username,
    full_name: fullname,
    email
  };

  const { error: profileError } = await supabaseClient
    .from('profiles')
    .update(profileUpdates)
    .eq('id', currentUser.id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    animateMessage(errorMessage, 'Failed to update profile. Please try again.');
    showLoadingButton(btn, false);
    return;
  }

  // Update auth email if changed
  if (email && email !== currentUser.email) {
    const { error: emailError } = await supabaseClient.auth.update({ email });
    if (emailError) {
      console.warn('Email update error:', emailError);
      animateMessage(errorMessage, 'Failed to update email. Please try again.');
      showLoadingButton(btn, false);
      return;
    }
  }

  // Update password if provided
  if (newPassword) {
    if (newPassword !== confirmPassword) {
      animateMessage(errorMessage, "New passwords do not match");
      showLoadingButton(btn, false);
      return;
    }
    if (getPasswordStrength(newPassword) < 2) {
      animateMessage(errorMessage, "New password is too weak");
      showLoadingButton(btn, false);
      return;
    }

    const { error: passwordError } = await supabaseClient.auth.update({ password: newPassword });
    if (passwordError) {
      console.warn('Password update error:', passwordError);
      animateMessage(errorMessage, "Failed to update password");
      showLoadingButton(btn, false);
      return;
    }
  }

  // Update local user cache
  const updatedUser = {
    ...currentUser,
    fullname,
    username,
    email
  };
  localStorage.setItem("currentUser", JSON.stringify(updatedUser));
  sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));

  document.getElementById("profile-name").textContent = fullname || username || currentUser.fullname;
  document.getElementById("profile-email").textContent = email;

  animateMessage(errorMessage, "Profile updated successfully", false);
  document.getElementById("new-password").value = "";
  document.getElementById("confirm-password").value = "";
  showLoadingButton(btn, false);
}

function handleProfilePictureUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) {
    alert('Please select an image file');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert('Image size should be less than 2MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(event) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
    const profilePicture = document.getElementById("profile-picture");
    profilePicture.innerHTML = `<img src="${event.target.result}" alt="${currentUser.fullname}">`;

    // Save to Supabase profile record
    supabaseClient
      .from('profiles')
      .update({ avatar_url: event.target.result, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (error) {
          console.warn('Error updating avatar_url in Supabase:', error);
        }
      });

    // Save locally for quick UI feedback
    currentUser.picture = event.target.result;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
  };
  reader.readAsDataURL(file);
}

function updatePasswordStrength() {
  const password = document.getElementById("new-password").value;
  const strengthBar = document.querySelector(".strength-bar");
  const strengthText = document.querySelector(".strength-text");
  
  const strength = getPasswordStrength(password);
  
  // Update strength bar width
  strengthBar.style.width = `${(strength / 4) * 100}%`;
  
  // Update strength bar color and text
  if (strength === 0) {
    strengthBar.style.backgroundColor = "#dc3545";
    strengthText.textContent = "Very weak";
  } else if (strength === 1) {
    strengthBar.style.backgroundColor = "#ffc107";
    strengthText.textContent = "Weak";
  } else if (strength === 2) {
    strengthBar.style.backgroundColor = "#fd7e14";
    strengthText.textContent = "Medium";
  } else if (strength === 3) {
    strengthBar.style.backgroundColor = "#20c997";
    strengthText.textContent = "Strong";
  } else {
    strengthBar.style.backgroundColor = "#28a745";
    strengthText.textContent = "Very strong";
  }
}

function getPasswordStrength(password) {
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength += 1;
  
  // Contains lowercase and uppercase
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
  
  // Contains numbers
  if (/\d/.test(password)) strength += 1;
  
  // Contains special characters
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
  
  return strength;
}

function checkPasswordMatch() {
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const errorMessage = document.getElementById("error-message");
  
  if (confirmPassword && newPassword !== confirmPassword) {
    errorMessage.textContent = "Passwords do not match";
  } else {
    errorMessage.textContent = "";
  }
}

function savePreferences() {
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  // Get all users
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  
  if (userIndex === -1) return;
  
  // Get selected genres
  const selectedGenres = [];
  document.querySelectorAll('input[name="genre"]:checked').forEach(checkbox => {
    selectedGenres.push(checkbox.value);
  });
  
  // Get content rating preference
  const contentRating = document.getElementById("content-rating").value;
  
  // Get notification preferences
  const emailNotifications = document.getElementById("email-notifications").checked;
  const browserNotifications = document.getElementById("browser-notifications").checked;
  
  // Create preferences object
  const preferences = {
    genres: selectedGenres,
    contentRating: contentRating,
    notifications: {
      email: emailNotifications,
      browser: browserNotifications
    }
  };
  
  // Update user preferences
  users[userIndex].preferences = preferences;
  localStorage.setItem("users", JSON.stringify(users));
  
  // Show success message
  alert("Preferences saved successfully");
}

function loadUserPreferences() {
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  // Get all users
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const user = users.find(u => u.id === currentUser.id);
  
  if (!user || !user.preferences) return;
  
  // Set genre checkboxes
  if (user.preferences.genres) {
    user.preferences.genres.forEach(genre => {
      const checkbox = document.querySelector(`input[name="genre"][value="${genre}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
  
  // Set content rating
  if (user.preferences.contentRating) {
    document.getElementById("content-rating").value = user.preferences.contentRating;
  }
  
  // Set notification preferences
  if (user.preferences.notifications) {
    document.getElementById("email-notifications").checked = user.preferences.notifications.email;
    document.getElementById("browser-notifications").checked = user.preferences.notifications.browser;
  }
}

async function loadRecentlyViewed() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  const recentlyViewedContainer = document.getElementById("recently-viewed");

  if (!currentUser) {
    recentlyViewedContainer.innerHTML = '<p class="empty-message">No recently viewed movies</p>';
    return;
  }

  const { data: recentlyViewed, error } = await supabaseClient
    .from('recently_viewed')
    .select('movie_id, viewed_at')
    .eq('user_id', currentUser.id)
    .order('viewed_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching recently viewed:', error);
    recentlyViewedContainer.innerHTML = '<p class="empty-message">Error loading recently viewed movies</p>';
    return;
  }

  if (!recentlyViewed || recentlyViewed.length === 0) {
    recentlyViewedContainer.innerHTML = '<p class="empty-message">No recently viewed movies</p>';
    return;
  }

  recentlyViewedContainer.innerHTML = '';
  
  const movies = await Promise.all(recentlyViewed.map(item => 
    fetch(`https://www.omdbapi.com/?i=${item.movie_id}&apikey=${API_KEY}`)
      .then(res => res.json())
  ));
  
  movies.forEach((movie, index) => {
    const movieItem = document.createElement('div');
    movieItem.className = 'activity-item';
    movieItem.innerHTML = `
        <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/50x75?text=No+Image'}" alt="${movie.Title}">
        <div class="activity-details">
          <h5><a href="movie-details.html?id=${movie.imdbID}">${movie.Title}</a></h5>
          <p>Viewed on ${new Date().toLocaleDateString()}</p>
        </div>
      `;
    recentlyViewedContainer.appendChild(movieItem);
  });
}

async function loadUserRatings() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  const userRatingsContainer = document.getElementById("user-ratings");

  if (!currentUser) {
    userRatingsContainer.innerHTML = '<p class="empty-message">No ratings yet</p>';
    return;
  }

  // Fetch ratings from Supabase
  const { data: ratings, error } = await supabaseClient
    .from('ratings')
    .select('movie_id, rating, updated_at')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching ratings from Supabase:', error);
    userRatingsContainer.innerHTML = '<p class="empty-message">Error loading ratings</p>';
    return;
  }

  if (!ratings || ratings.length === 0) {
    userRatingsContainer.innerHTML = '<p class="empty-message">No ratings yet</p>';
    return;
  }

  userRatingsContainer.innerHTML = '';

  const movies = await Promise.all(ratings.map(rating =>
    fetch(`https://www.omdbapi.com/?i=${rating.movie_id}&apikey=${API_KEY}`)
      .then(res => res.json())
  ));

  movies.forEach((movie, index) => {
    const rating = ratings[index];
    const movieItem = document.createElement('div');
    movieItem.className = 'activity-item';
    movieItem.innerHTML = `
      <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/50x75?text=No+Image'}" alt="${movie.Title}">
      <div class="activity-details">
        <h5><a href="movie-details.html?id=${movie.imdbID}">${movie.Title}</a></h5>
        <p>Your rating: ${'★'.repeat(rating.rating)}${'☆'.repeat(5-rating.rating)}</p>
        <p>Rated on ${new Date(rating.updated_at).toLocaleDateString()}</p>
      </div>
    `;
    userRatingsContainer.appendChild(movieItem);
  });
}

async function loadUserComments() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  const userCommentsContainer = document.getElementById("user-comments");

  if (!currentUser) {
    userCommentsContainer.innerHTML = '<p class="empty-message">No comments yet</p>';
    return;
  }

  const { data: comments, error } = await supabaseClient
    .from('comments')
    .select('movie_id, content, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching comments from Supabase:', error);
    userCommentsContainer.innerHTML = '<p class="empty-message">Error loading comments</p>';
    return;
  }

  if (!comments || comments.length === 0) {
    userCommentsContainer.innerHTML = '<p class="empty-message">No comments yet</p>';
    return;
  }

  userCommentsContainer.innerHTML = '';

  const movies = await Promise.all(comments.map(c =>
    fetch(`https://www.omdbapi.com/?i=${c.movie_id}&apikey=${API_KEY}`)
      .then(res => res.json())
  ));

  movies.forEach((movie, index) => {
    const comment = comments[index];
    const movieItem = document.createElement('div');
    movieItem.className = 'activity-item';
    movieItem.innerHTML = `
      <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/50x75?text=No+Image'}" alt="${movie.Title}">
      <div class="activity-details">
        <h5><a href="movie-details.html?id=${movie.imdbID}">${movie.Title}</a></h5>
        <p class="comment-text">"${comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content}"</p>
        <p>Commented on ${new Date(comment.created_at).toLocaleDateString()}</p>
      </div>
    `;
    userCommentsContainer.appendChild(movieItem);
  });
}

// Add this function to track recently viewed movies
async function addToRecentlyViewed(movieId) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) return;

  // Upsert viewed record so the most recent view is stored
  const { error } = await supabaseClient
    .from('recently_viewed')
    .upsert({
      user_id: currentUser.id,
      movie_id: movieId,
      viewed_at: new Date().toISOString()
    }, { onConflict: ['user_id', 'movie_id'] });

  if (error) {
    console.warn('Error saving recently viewed:', error);
  }
}

// Add this function to handle password reset
function requestPasswordReset() {
  const email = prompt("Please enter your email address to reset your password:");
  
  if (!email) return;
  
  // Check if email exists
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const user = users.find(u => u.email === email);
  
  if (!user) {
    alert("No account found with that email address.");
    return;
  }
  
  // Generate reset token
  const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const resetExpiry = Date.now() + 3600000; // 1 hour from now
  
  // Save reset token to user
  user.resetToken = resetToken;
  user.resetExpiry = resetExpiry;
  localStorage.setItem("users", JSON.stringify(users));
  
  // In a real app, you would send an email with a reset link
  // For this demo, we'll just show the reset token
  alert(`Password reset requested. In a real app, an email would be sent to ${email} with a reset link.\n\nFor demo purposes, your reset token is: ${resetToken}`);
}

// Add this function to verify email
function verifyEmail() {
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  // Get all users
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  
  if (userIndex === -1) return;
  
  // Generate verification token
  const verificationToken = Math.random().toString(36).substring(2, 15);
  
  // Save verification token to user
  users[userIndex].verificationToken = verificationToken;
  localStorage.setItem("users", JSON.stringify(users));
  
  // In a real app, you would send an email with a verification link
  // For this demo, we'll just show the verification token
  alert(`Email verification requested. In a real app, an email would be sent to ${currentUser.email} with a verification link.\n\nFor demo purposes, your verification token is: ${verificationToken}`);
}

// Add this function to enable two-factor authentication
function setupTwoFactorAuth() {
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  // Get all users
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  
  if (userIndex === -1) return;
  
  // Generate 2FA secret
  const twoFactorSecret = Math.random().toString(36).substring(2, 15);
  
  // Save 2FA secret to user
  users[userIndex].twoFactorSecret = twoFactorSecret;
  users[userIndex].twoFactorEnabled = true;
  localStorage.setItem("users", JSON.stringify(users));
  
  // In a real app, you would show a QR code for the user to scan with an authenticator app
  // For this demo, we'll just show the 2FA secret
  alert(`Two-factor authentication enabled. In a real app, you would scan a QR code with an authenticator app.\n\nFor demo purposes, your 2FA secret is: ${twoFactorSecret}`);
}

// Add spinner CSS
if (!document.getElementById('profile-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'profile-spinner-style';
  style.innerHTML = `.spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #fff; border-radius: 50%; border-top: 3px solid #e50914; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px; } @keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
