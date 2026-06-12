// Supabase setup from shared supabase-config.js
console.log('[details.js] startup', {windowSupabaseClient: window.supabaseClient, SUPABASE_URL: window.SUPABASE_URL});

if (!window.supabaseClient && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

const supabaseClient = window.supabaseClient;

// OMDb API key (from shared config, fallback to local constant)
const API_KEY = window.OMDB_API_KEY || "8ddfd56d"; // Use the same API key
const detailsContainer = document.getElementById("movie-details");
const loading = document.getElementById("loading");
const stars = document.querySelectorAll(".star");
const userRatingText = document.getElementById("user-rating");
const submitRatingBtn = document.getElementById("submit-rating");
const submitCommentBtn = document.getElementById("submit-comment");
const commentText = document.getElementById("comment-text");
const commentName = document.getElementById("comment-name");
const commentsContainer = document.getElementById("comments-container");
const watchlistBtn = document.getElementById("add-watchlist");
const movieGrid = document.getElementById("movie-grid");

// Replace with your YouTube Data API key
const YOUTUBE_API_KEY = "AIzaSyApOIxtyKdYc2TEsDG9ftluxyxD0Ka6K8k";

// Get movie ID from URL
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get("id");

let selectedRating = null; // Store selected rating globally

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser'));
}

async function addToRecentlyViewed(movieId) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

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

async function updateWatchlistButtonState(movieId) {
  if (!watchlistBtn) return;
  
  let isUserAuthenticated = false;
  let currentUser = null;
  
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      currentUser = getCurrentUser();
      isUserAuthenticated = !!currentUser;
    }
  } catch (e) {
    console.warn("Watchlist state auth check failed:", e);
  }

  if (!isUserAuthenticated) {
    const localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (localWatchlist.includes(movieId)) {
      watchlistBtn.textContent = "✓ In Watchlist";
      watchlistBtn.classList.add("in-watchlist");
    } else {
      watchlistBtn.textContent = "+ Add to Watchlist";
      watchlistBtn.classList.remove("in-watchlist");
    }
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('watchlist')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (!error && data) {
      watchlistBtn.textContent = "✓ In Watchlist";
      watchlistBtn.classList.add("in-watchlist");
    } else {
      watchlistBtn.textContent = "+ Add to Watchlist";
      watchlistBtn.classList.remove("in-watchlist");
    }
  } catch (e) {
    const localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (localWatchlist.includes(movieId)) {
      watchlistBtn.textContent = "✓ In Watchlist";
      watchlistBtn.classList.add("in-watchlist");
    } else {
      watchlistBtn.textContent = "+ Add to Watchlist";
      watchlistBtn.classList.remove("in-watchlist");
    }
  }
}

// Load movie details
document.addEventListener("DOMContentLoaded", async () => {
  if (!movieId) {
    window.location.href = "index.html";
    return;
  }
  
  setupThemeToggle();
  await fetchMovieDetails(movieId);
  await addToRecentlyViewed(movieId);
  await loadRecentlyViewed();
  await updateWatchlistButtonState(movieId);
  await setupRatingSystem();
  await loadComments();
  
  // Set up event listeners
  submitRatingBtn.addEventListener("click", submitRating);
  submitCommentBtn.addEventListener("click", submitComment);
});

function fetchMovieDetails(id) {
  loading.style.display = "block";
  
  fetch(`/api/movie?id=${id}`)
    .then(res => res.json())
    .then(movie => {
      loading.style.display = "none";
      
      if (!movie || movie.Response === "False") {
        detailsContainer.innerHTML = `<p style="text-align:center; color:#fff;">Movie details not found. Please try another movie.</p>`;
        return;
      }
      
      // Create movie details HTML
      const detailsHTML = `
        <div class="movie-poster">
          <img src="${movie.Poster !== "N/A" ? movie.Poster : "https://placehold.co/300x450?text=No+Image"}" alt="${movie.Title}" />
        </div>
        <div class="movie-info-details">
          <h1 class="movie-title">${movie.Title}</h1>
          <div class="movie-meta">
            <span>${movie.Year}</span>
            <span>${movie.Rated}</span>
            <span>${movie.Runtime}</span>
          </div>
          <p class="movie-plot">${movie.Plot}</p>
          
          <div class="movie-details-section">
            <h3>Genre</h3>
            <p>${movie.Genre}</p>
          </div>
          
          <div class="movie-details-section">
            <h3>Director</h3>
            <p>${movie.Director}</p>
          </div>
          
          <div class="movie-details-section">
            <h3>Cast</h3>
            <p>${movie.Actors && movie.Actors !== "N/A" ? movie.Actors.split(",").map(actor => `<span class="actor-link" onclick="window.openActorModal('${actor.trim().replace(/'/g, "\\'")}')">${actor.trim()}</span>`).join("") : "N/A"}</p>
          </div>
          
          <div class="movie-details-section">
            <h3>Awards</h3>
            <p>${movie.Awards}</p>
          </div>
        </div>
      `;
      
      detailsContainer.innerHTML = detailsHTML;
      renderRatingSummary(movie);
      loadStreamingAvailability(movie);

      // Populate static info grid fields
      const genreField = document.getElementById("genre");
      const runtimeField = document.getElementById("runtime");
      const languageField = document.getElementById("language");
      const imdbField = document.getElementById("imdb");

      if (genreField) genreField.textContent = movie.Genre || "N/A";
      if (runtimeField) runtimeField.textContent = movie.Runtime || "N/A";
      if (languageField) languageField.textContent = movie.Language || "N/A";
      if (imdbField) imdbField.textContent = movie.imdbRating ? `${movie.imdbRating} / 10` : "N/A";

      // Set page title
      document.title = `${movie.Title} - CinePrime`;
      
      // Fetch similar movies


      // After displaying movie details
      const mainGenre = movie.Genre ? movie.Genre.split(",")[0] : "";
      loadSimilarMovies(mainGenre, movie.imdbID);
      loadMovieTrailer(movie);
      loadAIInsights(movie.Title);
      setupAICoach(movie);
    })
    .catch(err => {
      console.error("Error fetching movie details:", err);
      detailsContainer.innerHTML = "<p>Error loading movie details. Please try again.</p>";
      loading.style.display = "none";
    });
}

function renderRatingSummary(movie) {
  const ratingSummary = document.getElementById('rating-summary');
  if (!ratingSummary) return;

  let ratingsList = [];

  // 1. IMDb
  const imdbVal = movie.imdbRating && movie.imdbRating !== 'N/A' ? parseFloat(movie.imdbRating) : null;
  const imdbVotes = movie.imdbVotes && movie.imdbVotes !== 'N/A' ? movie.imdbVotes : null;
  if (imdbVal !== null) {
    ratingsList.push({
      source: 'IMDb',
      score: `${imdbVal}/10`,
      percent: Math.round(imdbVal * 10),
      votes: imdbVotes ? `${imdbVotes} Votes` : ''
    });
  }

  // 2. Scan OMDb ratings array for Rotten Tomatoes, Metacritic, or others
  if (movie.Ratings && Array.isArray(movie.Ratings)) {
    movie.Ratings.forEach(r => {
      const source = r.Source;
      const value = r.Value;
      
      if (source === 'Rotten Tomatoes') {
        const match = value.match(/(\d+)%/);
        if (match) {
          const val = parseInt(match[1]);
          ratingsList.push({
            source: 'Rotten Tomatoes',
            score: value,
            percent: val,
            votes: ''
          });
        }
      } else if (source === 'Metacritic') {
        const match = value.match(/(\d+)\/100/);
        if (match) {
          const val = parseInt(match[1]);
          ratingsList.push({
            source: 'Metacritic',
            score: value,
            percent: val,
            votes: ''
          });
        }
      } else if (source === 'Internet Movie Database' && ratingsList.length === 0) {
        const match = value.match(/([\d.]+)\/10/);
        if (match) {
          const val = parseFloat(match[1]);
          ratingsList.push({
            source: 'IMDb',
            score: value,
            percent: Math.round(val * 10),
            votes: imdbVotes ? `${imdbVotes} Votes` : ''
          });
        }
      }
    });
  }

  if (ratingsList.length === 0) {
    ratingsList.push({
      source: 'N/A',
      score: 'N/A',
      percent: 0,
      votes: 'No rating data available'
    });
  }

  const circumference = 2 * Math.PI * 80;
  let html = '';
  
  ratingsList.forEach((r, idx) => {
    const dashOffset = (circumference - (r.percent / 100) * circumference).toFixed(1);
    
    let subtext = '';
    if (r.source === 'IMDb') {
      subtext = r.votes || 'IMDb Score';
    } else if (r.source === 'Rotten Tomatoes') {
      subtext = 'Tomatometer';
    } else if (r.source === 'Metacritic') {
      subtext = 'Metascore';
    } else {
      subtext = r.source;
    }

    let logoHtml = '';
    if (r.source === 'IMDb') {
      logoHtml = `<span class="rating-logo imdb-logo">IMDb</span>`;
    } else if (r.source === 'Rotten Tomatoes') {
      logoHtml = `<span class="rating-logo rt-logo">🍅 Rotten Tomatoes</span>`;
    } else if (r.source === 'Metacritic') {
      logoHtml = `<span class="rating-logo mc-logo">Metacritic</span>`;
    } else {
      logoHtml = `<span class="rating-logo">${r.source}</span>`;
    }

    html += `
      <div class="rating-gauge-card">
        ${logoHtml}
        <div class="rating-gauge small-gauge">
          <svg viewBox="0 0 200 200" class="rating-gauge-svg" aria-label="${r.source} rating gauge">
            <defs>
              <linearGradient id="ratingGradient_${idx}" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#22c55e" />
                <stop offset="40%" stop-color="#eab308" />
                <stop offset="70%" stop-color="#f97316" />
                <stop offset="100%" stop-color="#a855f7" />
              </linearGradient>
            </defs>
            <circle class="gauge-track" cx="100" cy="100" r="80" />
            <circle class="gauge-fill" cx="100" cy="100" r="80" stroke="url(#ratingGradient_${idx})" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" />
          </svg>
          <div class="rating-gauge-label">
            <span class="rating-percent">${r.percent}%</span>
            <span class="rating-subtext">${subtext}</span>
          </div>
        </div>
      </div>
    `;
  });

  ratingSummary.innerHTML = html;
}

async function loadStreamingAvailability(movie) {
  const container = document.getElementById("streaming-providers");
  if (!container) return;

  const title = movie.Title;
  const year = movie.Year || "";

  try {
    const response = await fetch(`/api/availability?title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch availability, status: ${response.status}`);
    }
    const data = await response.json();
    renderStreamingProviders(data);
  } catch (error) {
    console.error("Error loading streaming availability:", error);
    container.innerHTML = `<p class="no-providers">Streaming availability currently unavailable.</p>`;
  }
}

function renderStreamingProviders(data) {
  const container = document.getElementById("streaming-providers");
  if (!container) return;

  if ((!data.streaming || data.streaming.length === 0) && (!data.rent_buy || data.rent_buy.length === 0)) {
    container.innerHTML = `
      <div class="no-providers">
        <p>No active streaming or rental platforms found for this title in India.</p>
        <p style="margin-top: 8px; font-size: 13px;">You can check JustWatch directly: <a href="https://www.justwatch.com/in/search?q=${encodeURIComponent(document.title.replace(' - CinePrime', ''))}" target="_blank" style="color: #c084fc; text-decoration: underline;">JustWatch India</a></p>
      </div>
    `;
    return;
  }

  let html = '';

  const getProviderClass = (name) => {
    const clean = name.toLowerCase();
    if (clean.includes('netflix')) return 'netflix';
    if (clean.includes('prime')) return 'amazon-prime-video';
    if (clean.includes('hotstar')) return 'disney-hotstar';
    if (clean.includes('jiostar')) return 'jiostar';
    if (clean.includes('jiocinema')) return 'jiocinema';
    return '';
  };

  const getProviderIcon = (name) => {
    const clean = name.toLowerCase();
    if (clean.includes('netflix')) return '🔴';
    if (clean.includes('prime')) return '🔷';
    if (clean.includes('hotstar')) return '🌟';
    if (clean.includes('jiostar')) return '✨';
    if (clean.includes('jiocinema')) return '🍿';
    if (clean.includes('apple')) return '🍎';
    if (clean.includes('google')) return '🤖';
    if (clean.includes('youtube')) return '📺';
    return '🎬';
  };

  // 1. Subscription Streaming (Flatrate)
  if (data.streaming && data.streaming.length > 0) {
    html += `
      <div class="provider-group">
        <h4>Stream (Subscription)</h4>
        <div class="provider-list">
          ${data.streaming.map(p => `
            <div class="provider-badge ${getProviderClass(p)}">
              <span class="provider-icon">${getProviderIcon(p)}</span>
              <span>${p}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 2. Buy/Rent Platforms
  if (data.rent_buy && data.rent_buy.length > 0) {
    html += `
      <div class="provider-group">
        <h4>Rent or Buy</h4>
        <div class="provider-list">
          ${data.rent_buy.map(p => `
            <div class="provider-badge ${getProviderClass(p)}">
              <span class="provider-icon">${getProviderIcon(p)}</span>
              <span>${p}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

async function setupRatingSystem() {
  let isUserAuthenticated = false;
  let currentUser = null;
  
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      currentUser = getCurrentUser();
      isUserAuthenticated = !!currentUser;
    }
  } catch (e) {
    console.warn("Rating system auth check failed:", e);
  }

  if (!isUserAuthenticated) {
    const localRatings = JSON.parse(localStorage.getItem('local_ratings') || '{}');
    const localRating = localRatings[movieId];
    if (localRating) {
      selectedRating = parseInt(localRating);
      updateStars(selectedRating);
      userRatingText.textContent = `Your rating (local): ${selectedRating} out of 5`;
    } else {
      userRatingText.textContent = "Your rating: Not rated yet";
    }
  } else {
    try {
      const { data: ratingData, error } = await supabaseClient
        .from('ratings')
        .select('rating')
        .eq('user_id', currentUser.id)
        .eq('movie_id', movieId)
        .maybeSingle();

      if (!error && ratingData) {
        selectedRating = parseInt(ratingData.rating);
        updateStars(selectedRating);
        userRatingText.textContent = `Your rating: ${ratingData.rating} out of 5`;
      } else {
        userRatingText.textContent = "Your rating: Not rated yet";
      }
    } catch (error) {
      const localRatings = JSON.parse(localStorage.getItem('local_ratings') || '{}');
      const localRating = localRatings[movieId];
      if (localRating) {
        selectedRating = parseInt(localRating);
        updateStars(selectedRating);
        userRatingText.textContent = `Your rating (local): ${selectedRating} out of 5`;
      } else {
        userRatingText.textContent = "Your rating: Not rated yet";
      }
    }
  }

  // Add event listeners to stars
  stars.forEach(star => {
    star.addEventListener("click", () => {
      const rating = parseInt(star.getAttribute("data-rating"));
      selectedRating = rating;
      updateStars(rating);
      userRatingText.textContent = `Your rating: ${rating} out of 5`;
    });
  });
}

function updateStars(rating) {
  stars.forEach(star => {
    const starRating = parseInt(star.getAttribute("data-rating"));
    if (starRating <= rating) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  });
}

async function submitRating() {
  if (!selectedRating) {
    window.CinePrime?.showToast("Please select a rating first!", "error");
    return;
  }

  let isUserAuthenticated = false;
  let currentUser = null;
  
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      currentUser = getCurrentUser();
      isUserAuthenticated = !!currentUser;
    }
  } catch (e) {
    console.warn("Rating system submit auth check failed:", e);
  }

  if (!isUserAuthenticated) {
    // Save to local storage
    const localRatings = JSON.parse(localStorage.getItem('local_ratings') || '{}');
    localRatings[movieId] = selectedRating;
    localStorage.setItem('local_ratings', JSON.stringify(localRatings));
    window.CinePrime?.showToast(`Rated ${selectedRating}/5 stars locally! ✅`);
    userRatingText.textContent = `Your rating (local): ${selectedRating} out of 5`;
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('ratings')
      .upsert({
        user_id: currentUser.id,
        movie_id: movieId,
        rating: selectedRating,
        updated_at: new Date().toISOString()
      }, { onConflict: ['user_id', 'movie_id'] });

    if (error) {
      console.error('Error saving rating:', error);
      window.CinePrime?.showToast('Saving rating locally...', 'info');
      
      const localRatings = JSON.parse(localStorage.getItem('local_ratings') || '{}');
      localRatings[movieId] = selectedRating;
      localStorage.setItem('local_ratings', JSON.stringify(localRatings));
      userRatingText.textContent = `Your rating (local): ${selectedRating} out of 5`;
      return;
    }

    window.CinePrime?.showToast(`Submitted rating of ${selectedRating} stars! ✅`);
    userRatingText.textContent = `Your rating: ${selectedRating} out of 5`;
  } catch (err) {
    console.error('Rating submit error:', err);
    window.CinePrime?.showToast('Saved locally due to connection error.', 'info');
    
    const localRatings = JSON.parse(localStorage.getItem('local_ratings') || '{}');
    localRatings[movieId] = selectedRating;
    localStorage.setItem('local_ratings', JSON.stringify(localRatings));
    userRatingText.textContent = `Your rating (local): ${selectedRating} out of 5`;
  }
}


async function submitComment() {
  const text = commentText.value.trim();
  const authorName = commentName.value.trim() || 'Anonymous Guest';

  if (!text) {
    window.CinePrime?.showToast("Please enter a comment!", "error");
    return;
  }

  let isUserAuthenticated = false;
  let currentUser = null;
  
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      currentUser = getCurrentUser();
      isUserAuthenticated = !!currentUser;
    }
  } catch (e) {
    console.warn("Comment system auth check failed:", e);
  }

  if (!isUserAuthenticated) {
    const localComment = {
      name: authorName,
      text: text,
      date: new Date().toISOString()
    };
    
    const allLocalComments = JSON.parse(localStorage.getItem('local_comments') || '{}');
    if (!allLocalComments[movieId]) allLocalComments[movieId] = [];
    allLocalComments[movieId].unshift(localComment);
    localStorage.setItem('local_comments', JSON.stringify(allLocalComments));

    commentText.value = "";
    commentName.value = "";
    
    await loadComments();
    window.CinePrime?.showToast("Comment posted locally! ✅");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('comments')
      .insert([{ 
        user_id: currentUser.id,
        movie_id: movieId,
        content: text
      }]);

    if (error) {
      console.error('Error saving comment:', error);
      window.CinePrime?.showToast('Saving comment locally...', 'info');
      
      const localComment = {
        name: currentUser.username || currentUser.email.split('@')[0],
        text: text,
        date: new Date().toISOString()
      };
      const allLocalComments = JSON.parse(localStorage.getItem('local_comments') || '{}');
      if (!allLocalComments[movieId]) allLocalComments[movieId] = [];
      allLocalComments[movieId].unshift(localComment);
      localStorage.setItem('local_comments', JSON.stringify(allLocalComments));
      
      commentText.value = "";
      commentName.value = "";
      await loadComments();
      return;
    }

    commentText.value = "";
    commentName.value = "";

    await loadComments();
    window.CinePrime?.showToast("Comment posted successfully! ✅");
  } catch (err) {
    console.error('Comment submit error:', err);
    window.CinePrime?.showToast('Saved locally due to connection error.', 'info');
    
    const localComment = {
      name: currentUser ? (currentUser.username || currentUser.email.split('@')[0]) : 'Anonymous Guest',
      text: text,
      date: new Date().toISOString()
    };
    const allLocalComments = JSON.parse(localStorage.getItem('local_comments') || '{}');
    if (!allLocalComments[movieId]) allLocalComments[movieId] = [];
    allLocalComments[movieId].unshift(localComment);
    localStorage.setItem('local_comments', JSON.stringify(allLocalComments));
    
    commentText.value = "";
    commentName.value = "";
    await loadComments();
  }
}

async function loadComments() {
  commentsContainer.innerHTML = '';
  
  // Load local comments first
  const allLocalComments = JSON.parse(localStorage.getItem('local_comments') || '{}');
  const localComments = allLocalComments[movieId] || [];
  
  let databaseComments = [];
  let isOffline = true;

  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      const { data: comments, error } = await supabaseClient
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('movie_id', movieId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (!error && comments) {
        databaseComments = comments;
        isOffline = false;
      }
    }
  } catch (error) {
    console.warn("Could not load comments from Supabase:", error);
  }

  // Render local comments
  localComments.forEach(comment => {
    addCommentToPage(comment);
  });

  // Render database comments
  if (!isOffline && databaseComments.length > 0) {
    for (const comment of databaseComments) {
      let author = 'Anonymous';
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('username')
          .eq('id', comment.user_id)
          .maybeSingle();

        if (profile && profile.username) {
          author = profile.username;
        }
      } catch (profileError) {
        console.warn('Could not fetch profile for comment:', profileError);
      }

      addCommentToPage({
        name: author,
        text: comment.content,
        date: comment.created_at
      });
    }
  }

  if (localComments.length === 0 && databaseComments.length === 0) {
    commentsContainer.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
  }
}

function addCommentToPage(comment) {
  // Format the date
  const date = new Date(comment.date);
  const formattedDate = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  
  // Create comment HTML
  const commentElement = document.createElement('div');
  commentElement.classList.add('comment');
  commentElement.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${comment.name}</span>
      <span class="comment-date">${formattedDate}</span>
    </div>
    <div class="comment-content">${comment.text}</div>
  `;
  
  // Add to container
  if (commentsContainer.querySelector('.no-comments')) {
    commentsContainer.innerHTML = '';
  }
  commentsContainer.appendChild(commentElement);
}

function getYouTubeEmbedSrc(trailerUrl) {
  if (!trailerUrl) return null;
  const trimmed = String(trailerUrl).trim();
  if (!trimmed) return null;

  // Extract video id from common YouTube URL formats.
  // Examples:
  // - https://www.youtube.com/watch?v=VIDEOID
  // - https://youtu.be/VIDEOID
  // - https://www.youtube.com/embed/VIDEOID
  // - https://www.youtube.com/shorts/VIDEOID
  const patterns = [
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  return null;
}

function getYouTubeSearchEmbedSrc(searchQuery) {
  // YouTube embed "search mode" does not require API key.
  // It will show results and start with the first match.
  const q = String(searchQuery || "").trim();
  if (!q) return null;
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(q)}`;
}

function loadMovieTrailer(movie) {
  const trailerSection = document.getElementById("trailer-section");
  if (!trailerSection) return;
  trailerSection.innerHTML = "<p>Loading trailer...</p>";

  const title = movie?.Title || "";
  const year = movie?.Year || "";
  const searchQuery = `${title} ${year} official trailer`.trim();

  if (!title) {
    trailerSection.innerHTML = "<p>No trailer available.</p>";
    return;
  }

  const encodedQuery = encodeURIComponent(searchQuery);

  // If YouTube API quota is exhausted, stop calling it again.
  if (localStorage.getItem("yt-quota-exceeded") === "1") {
    trailerSection.innerHTML = `
      <p>Trailer unavailable right now.</p>
      <p><a href="https://www.youtube.com/results?search_query=${encodedQuery}" target="_blank" rel="noopener noreferrer">Search on YouTube</a></p>
    `;
    return;
  }

  fetch(`/api/trailer?q=${encodedQuery}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.error && data.error.message) {
        const msg = String(data.error.message || "");
        if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("exceeded")) {
          localStorage.setItem("yt-quota-exceeded", "1");
        }
        trailerSection.innerHTML = `
          <p>Failed to load trailer (YouTube API): ${msg}</p>
          <p><a href="https://www.youtube.com/results?search_query=${encodedQuery}" target="_blank" rel="noopener noreferrer">Search on YouTube</a></p>
        `;
        return;
      }

      const videoId = data?.items?.[0]?.id?.videoId;
      if (!videoId) {
        trailerSection.innerHTML = `
          <p>No trailer found.</p>
          <p><a href="https://www.youtube.com/results?search_query=${encodedQuery}" target="_blank" rel="noopener noreferrer">Search on YouTube</a></p>
        `;
        return;
      }

      // Dynamically inject "Watch Trailer" glowing play button in banner-buttons
      const bannerBtns = document.querySelector('.banner-buttons');
      if (bannerBtns && !document.getElementById('watch-trailer-banner')) {
        const trailerBtn = document.createElement('button');
        trailerBtn.id = 'watch-trailer-banner';
        trailerBtn.className = 'btn watch-trailer-btn';
        trailerBtn.innerHTML = '🎬 Watch Trailer';
        trailerBtn.onclick = () => window.openTrailerLightbox(videoId);
        bannerBtns.insertBefore(trailerBtn, bannerBtns.firstChild);
      }

      trailerSection.innerHTML = `
        <h3>Trailer</h3>
        <div class="trailer-container">
          <iframe width="100%" height="315"
            src="https://www.youtube.com/embed/${videoId}"
            frameborder="0" allowfullscreen>
          </iframe>
        </div>
      `;
    })
    .catch(() => {
      trailerSection.innerHTML = `
        <p>Failed to load trailer.</p>
        <p><a href="https://www.youtube.com/results?search_query=${encodedQuery}" target="_blank" rel="noopener noreferrer">Search on YouTube</a></p>
      `;
    });
}

async function loadRecentlyViewed() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const { data: recentlyViewed, error } = await supabaseClient
    .from('recently_viewed')
    .select('movie_id, viewed_at')
    .eq('user_id', currentUser.id)
    .order('viewed_at', { ascending: false })
    .limit(5);

  if (error) {
    console.warn('Error fetching recently viewed:', error);
    return;
  }

  if (!recentlyViewed || recentlyViewed.length === 0) return;

  const recentlySection = document.createElement('div');
  recentlySection.classList.add('recently-viewed');
  recentlySection.innerHTML = `
    <h3>Recently Viewed Movies</h3>
    <div class="recently-grid movie-row"></div>
  `;

  const recentlyGrid = recentlySection.querySelector('.recently-grid');

  const movies = await Promise.all(recentlyViewed.map(item =>
    fetch(`/api/omdb?i=${item.movie_id}`)
      .then(res => res.json())
      .catch(() => null)
  ));

  movies.forEach((details, index) => {
    if (!details || details.Response === 'False') return;
    const movieCard = createMovieCard(details);
    recentlyGrid.appendChild(movieCard);
  });

  const trailerSec = document.getElementById('trailer-section');
  if (trailerSec) {
    trailerSec.after(recentlySection);
  } else {
    document.querySelector('.details-container').after(recentlySection);
  }
}

function loadSimilarMovies(mainGenre, excludeId) {
  const similarGrid = document.getElementById("similar-movies-grid");
  if (!similarGrid) return;
  similarGrid.innerHTML = "Loading...";

  fetch(`/api/omdb?s=${encodeURIComponent(mainGenre)}&type=movie`)
    .then(res => res.json())
    .then(data => {
      if (data.Response === "True") {
        // Exclude the current movie and limit to 6
        const filtered = data.Search.filter(m => m.imdbID !== excludeId).slice(0, 6);
        similarGrid.innerHTML = "";
        filtered.forEach(movie => {
          const movieCard = createMovieCard(movie);
          similarGrid.appendChild(movieCard);
        });
      } else {
        similarGrid.innerHTML = "<p>No similar movies found.</p>";
      }
    })
    .catch(() => {
      similarGrid.innerHTML = "<p>Failed to load similar movies.</p>";
    });
}

function loadAIInsights(title) {
  const insightsContainer = document.getElementById("ai-insights-content");
  insightsContainer.innerHTML = '<div class="loading-spinner"></div> Generating AI insights...';

  // Get movie data for better insights
  fetch(`/api/omdb?i=${movieId}&plot=full`)
    .then(res => res.json())
    .then(movie => {
      const insights = generateAIInsights(movie);
      insightsContainer.innerHTML = insights;

      // Also load AI recommendations
      loadAIRecommendations(movie);
    })
    .catch(() => {
      // Fallback to basic insights
      const facts = [
        `Did you know? "${title}" was one of the most searched movies of its release year!`,
        `AI says: "${title}" is recommended for fans of adventure and drama.`,
        `Fun fact: Many viewers rated "${title}" highly for its soundtrack!`
      ];
      insightsContainer.textContent = facts[Math.floor(Math.random() * facts.length)];
    });
}

function generateAIInsights(movie) {
  const { Title, Genre, Director, Actors, Plot, Year, imdbRating, Awards } = movie;

  // Analyze movie characteristics
  const genres = Genre ? Genre.split(', ') : [];
  const isRecent = parseInt(Year) > 2010;
  const isHighlyRated = parseFloat(imdbRating) > 7.5;
  const hasAwards = Awards && Awards !== 'N/A';

  let insights = `<div class="ai-insight-card">
    <h4>🎬 AI Movie Analysis</h4>
    <div class="insight-content">`;

  // Genre-based insights
  if (genres.includes('Action')) {
    insights += `<p>⚡ <strong>Action-Packed:</strong> This film delivers high-octane sequences perfect for adrenaline seekers!</p>`;
  }
  if (genres.includes('Drama')) {
    insights += `<p>🎭 <strong>Emotional Depth:</strong> Expect compelling character development and thought-provoking themes.</p>`;
  }
  if (genres.includes('Comedy')) {
    insights += `<p>😄 <strong>Lighthearted Fun:</strong> Great for stress relief and family entertainment.</p>`;
  }
  if (genres.includes('Horror')) {
    insights += `<p>👻 <strong>Thrilling Experience:</strong> Perfect for fans of suspense and supernatural elements.</p>`;
  }
  if (genres.includes('Sci-Fi')) {
    insights += `<p>🚀 <strong>Mind-Bending:</strong> Explores futuristic concepts and technological wonders.</p>`;
  }

  // Rating-based insights
  if (isHighlyRated) {
    insights += `<p>⭐ <strong>Critically Acclaimed:</strong> With a ${imdbRating}/10 IMDb rating, this movie has impressed critics and audiences alike!</p>`;
  }

  // Awards insights
  if (hasAwards) {
    insights += `<p>🏆 <strong>Award-Winning:</strong> This film has received recognition for its excellence in filmmaking.</p>`;
  }

  // Director insights
  if (Director && Director !== 'N/A') {
    insights += `<p>🎥 <strong>Directed by ${Director}:</strong> A filmmaker known for ${genres[0] || 'compelling'} storytelling.</p>`;
  }

  // Year-based insights
  if (isRecent) {
    insights += `<p>🆕 <strong>Modern Classic:</strong> Released in ${Year}, this film reflects contemporary cinematic techniques and themes.</p>`;
  } else {
    insights += `<p>📽️ <strong>Timeless Appeal:</strong> From ${Year}, this movie continues to captivate audiences with its enduring quality.</p>`;
  }

  // Plot-based insights
  if (Plot && Plot.length > 50) {
    const plotWords = Plot.split(' ').length;
    if (plotWords > 100) {
      insights += `<p>📖 <strong>Rich Narrative:</strong> This film weaves a complex story that will keep you engaged throughout.</p>`;
    } else {
      insights += `<p>🎯 <strong>Focused Story:</strong> A concise yet impactful narrative that delivers its message effectively.</p>`;
    }
  }

  insights += `</div></div>`;

  return insights;
}

// AI-Powered Movie Recommendations
async function loadAIRecommendations(currentMovie) {
  const currentUser = getCurrentUser();
  const recommendationsContainer = document.createElement('div');
  recommendationsContainer.id = 'ai-recommendations';
  recommendationsContainer.innerHTML = `
    <h3>🤖 AI Recommendations</h3>
    <div class="ai-recommendations-grid" id="ai-recommendations-grid">
      <div class="loading-spinner"></div> Finding perfect matches...
    </div>
  `;

  // Insert after AI insights section
  const aiSection = document.querySelector('.ai-insights-section');
  aiSection.appendChild(recommendationsContainer);

  try {
    const genres = currentMovie.Genre ? currentMovie.Genre.split(', ') : [];
    const director = currentMovie.Director;
    const actors = currentMovie.Actors ? currentMovie.Actors.split(', ') : [];

    // Get user's watchlist and ratings for personalized recommendations
    let userPreferences = { likedGenres: [], dislikedGenres: [] };

    if (currentUser) {
      // Get user's ratings
      const { data: ratings } = await supabaseClient
        .from('ratings')
        .select('movie_id, rating')
        .eq('user_id', currentUser.id);

      if (ratings && ratings.length > 0) {
        // Analyze user's preferences
        const highRatedMovies = ratings.filter(r => r.rating >= 4).map(r => r.movie_id);
        const lowRatedMovies = ratings.filter(r => r.rating <= 2).map(r => r.movie_id);

        // Get genres of highly rated movies
        for (const movieId of highRatedMovies.slice(0, 3)) {
          try {
            const res = await fetch(`/api/omdb?i=${movieId}`);
            const movie = await res.json();
            if (movie.Genre) {
              userPreferences.likedGenres.push(...movie.Genre.split(', '));
            }
          } catch (e) {
            console.warn('Could not fetch movie for preferences:', movieId);
          }
        }
      }
    }

    // Generate smart recommendations
    const recommendations = await generateSmartRecommendations(
      genres[0], // Primary genre
      currentMovie.imdbID,
      userPreferences,
      director,
      actors[0] // Lead actor
    );

    displayAIRecommendations(recommendations);

  } catch (error) {
    console.error('AI Recommendations error:', error);
    document.getElementById('ai-recommendations-grid').innerHTML =
      '<p>Unable to load AI recommendations at this time.</p>';
  }
}

async function generateSmartRecommendations(primaryGenre, excludeId, userPrefs, director, leadActor) {
  const recommendations = [];

  // Strategy 1: Same genre, different director/actor
  try {
    const res = await fetch(`/api/omdb?s=${encodeURIComponent(primaryGenre)}&type=movie`);
    const data = await res.json();

    if (data.Search) {
      const filtered = data.Search
        .filter(movie => movie.imdbID !== excludeId)
        .slice(0, 6);

      for (const movie of filtered) {
        const detailsRes = await fetch(`/api/omdb?i=${movie.imdbID}`);
        const details = await detailsRes.json();

        if (details && details.imdbRating && parseFloat(details.imdbRating) > 6.0) {
          recommendations.push({
            ...details,
            aiReason: `Similar ${primaryGenre.toLowerCase()} movie with strong reviews`
          });
        }
      }
    }
  } catch (e) {
    console.warn('Genre-based recommendations failed:', e);
  }

  // Strategy 2: User's preferred genres (if available)
  if (userPrefs.likedGenres.length > 0) {
    const preferredGenre = userPrefs.likedGenres[0];
    if (preferredGenre !== primaryGenre) {
      try {
const res = await fetch(`/api/omdb?s=${encodeURIComponent(preferredGenre)}&type=movie`);
        const data = await res.json();

        if (data.Search) {
          const filtered = data.Search
            .filter(movie => movie.imdbID !== excludeId && !recommendations.find(r => r.imdbID === movie.imdbID))
            .slice(0, 3);

          for (const movie of filtered) {
            const detailsRes = await fetch(`/api/omdb?i=${movie.imdbID}`);
            const details = await detailsRes.json();

            if (details) {
              recommendations.push({
                ...details,
                aiReason: `Based on your love for ${preferredGenre.toLowerCase()} movies`
              });
            }
          }
        }
      } catch (e) {
        console.warn('User preference recommendations failed:', e);
      }
    }
  }

  // Strategy 3: Highly rated movies in similar genres
  const similarGenres = {
    'Action': ['Adventure', 'Thriller'],
    'Drama': ['Romance', 'Biography'],
    'Comedy': ['Romance', 'Family'],
    'Horror': ['Thriller', 'Mystery'],
    'Sci-Fi': ['Adventure', 'Fantasy']
  };

  const relatedGenres = similarGenres[primaryGenre] || [];
  for (const genre of relatedGenres.slice(0, 1)) {
    try {
      const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(genre)}&type=movie&apikey=${API_KEY}`);
      const data = await res.json();

      if (data.Search) {
        const filtered = data.Search
          .filter(movie => movie.imdbID !== excludeId && !recommendations.find(r => r.imdbID === movie.imdbID))
          .slice(0, 2);

        for (const movie of filtered) {
          const detailsRes = await fetch(`https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${API_KEY}`);
          const details = await detailsRes.json();

          if (details && details.imdbRating && parseFloat(details.imdbRating) > 7.0) {
            recommendations.push({
              ...details,
              aiReason: `Explore ${genre.toLowerCase()} - related to ${primaryGenre.toLowerCase()}`
            });
          }
        }
      }
    } catch (e) {
      console.warn('Related genre recommendations failed:', e);
    }
  }

  // Return top 6 recommendations
  return recommendations.slice(0, 6);
}

function displayAIRecommendations(recommendations) {
  const grid = document.getElementById('ai-recommendations-grid');

  if (!recommendations || recommendations.length === 0) {
    grid.innerHTML = '<p>No AI recommendations available at this time.</p>';
    return;
  }

  grid.innerHTML = '';

  recommendations.forEach(movie => {
    const movieCard = document.createElement('div');
    movieCard.className = 'ai-recommendation-card';
    movieCard.innerHTML = `
      <div class="ai-rec-poster">
        <img src="${movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://placehold.co/200x300?text=No+Image'}"
             alt="${movie.Title}"
             onerror="this.src='https://placehold.co/200x300?text=No+Image'">
        <div class="ai-reason">${movie.aiReason}</div>
      </div>
      <div class="ai-rec-info">
        <h4><a href="movie-details.html?id=${movie.imdbID}">${movie.Title}</a></h4>
        <p class="ai-rec-year">${movie.Year}</p>
        <p class="ai-rec-rating">⭐ ${movie.imdbRating}/10</p>
      </div>
    `;
    grid.appendChild(movieCard);
  });
}


// Add to details.js
function votePoll(option) {
  let poll = JSON.parse(localStorage.getItem("poll-" + movieId) || '{"yes":0,"no":0}');
  poll[option]++;
  localStorage.setItem("poll-" + movieId, JSON.stringify(poll));
  renderPollResults();
}
function renderPollResults() {
  let poll = JSON.parse(localStorage.getItem("poll-" + movieId) || '{"yes":0,"no":0}');
  document.getElementById("poll-results").textContent =
    `Yes: ${poll.yes} | No: ${poll.no}`;
}

function generateAICoachTip(movie) {
  const moods = [
    "chill night", "thriller binge", "epic weekend", "romantic vibe", "family movie time"
  ];
  const actions = [
    "Create a custom playlist with 3 similar films", 
    "Write a short review after watching", 
    "Compare it with your favorite director's style", 
    "Pick one character and guess their next move", 
    "Share with friends and vote on best scene"
  ];

  const genre = movie.Genre ? movie.Genre.split(',')[0] : 'movie';
  const randomMood = moods[Math.floor(Math.random() * moods.length)];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];

  return `🧠 AI Coach: For this ${genre} film, try a ${randomMood}. ${randomAction} to make the experience more memorable.`;
}

function setupAICoach(movie) {
  const aiBtn = document.getElementById('ai-coach-btn');
  const aiOutput = document.getElementById('ai-coach-output');
  if (!aiBtn || !aiOutput) return;

  const update = () => {
    aiOutput.textContent = generateAICoachTip(movie);
  };

  aiBtn.addEventListener('click', update);

  // Show initial tip once
  update();
}

// Call renderPollResults() on page load
renderPollResults();

async function fetchMovies() {
  const { data, error } = await supabaseClient.from('movies').select('*');
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function addRating(user_id, movie_id, rating) {
  const { error } = await supabaseClient.from('ratings').insert([{ user_id, movie_id, rating }]);
  if (error) alert('Error adding rating');
}

async function addComment(user_id, movie_id, text) {
  const { error } = await supabaseClient.from('comments').insert([{ user_id, movie_id, text }]);
  if (error) alert('Error adding comment');
}

async function showAllSupabaseMovies() {
  const movies = await fetchMovies();
  movieGrid.innerHTML = "";
  movies.forEach(movie => {
    const poster = movie.poster || "https://placehold.co/300x450?text=No+Image";
    movieGrid.innerHTML += `
      <div class="movie-card">
        <div class="movie-thumbnail-container">
          <img class="movie-thumbnail" src="${poster}" alt="${movie.title}">
          <div class="trailer-preview" style="display:none"></div>
        </div>
        <div class="movie-info">
          <h3>${movie.title}</h3>
          <p>${movie.year}</p>
        </div>
      </div>
    `;
  });
  setupTrailerPreview("#movie-grid");
}
function goHome(){
window.location.href = "index.html";
}

function goBack(){
window.history.back();
}

async function toggleWatchlist(movieId) {
  let isUserAuthenticated = false;
  let currentUser = null;
  
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      currentUser = getCurrentUser();
      isUserAuthenticated = !!currentUser;
    }
  } catch (e) {
    console.warn("Watchlist auth pre-check failed:", e);
  }

  if (!isUserAuthenticated) {
    // Fallback to local storage watchlist
    let localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const index = localWatchlist.indexOf(movieId);
    if (index > -1) {
      localWatchlist.splice(index, 1);
      localStorage.setItem('watchlist', JSON.stringify(localWatchlist));
      window.CinePrime?.showToast("Removed from local watchlist ❌");
    } else {
      localWatchlist.push(movieId);
      localStorage.setItem('watchlist', JSON.stringify(localWatchlist));
      window.CinePrime?.showToast("Added to local watchlist ✅ (Log in to sync!)");
    }
    updateWatchlistButtonState(movieId);
    return;
  }

  // Check existing watchlist entry
  const { data: existing, error: checkError } = await supabaseClient
    .from('watchlist')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('movie_id', movieId);

  if (checkError) {
    console.error('Error checking watchlist:', checkError);
    window.CinePrime?.showToast("Error checking watchlist status.", "error");
    return;
  }

  if (existing && existing.length > 0) {
    const { error } = await supabaseClient
      .from('watchlist')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('movie_id', movieId);

    if (error) {
      console.error('Error removing from watchlist:', error);
      window.CinePrime?.showToast("Error removing from watchlist.", "error");
      return;
    }

    // Sync local storage replica
    let local = JSON.parse(localStorage.getItem('watchlist') || '[]');
    local = local.filter(id => id !== movieId);
    localStorage.setItem('watchlist', JSON.stringify(local));

    window.CinePrime?.showToast("Removed from watchlist ❌");
    updateWatchlistButtonState(movieId);
  } else {
    const { error } = await supabaseClient
      .from('watchlist')
      .upsert([{ user_id: currentUser.id, movie_id: movieId }], { onConflict: ['user_id', 'movie_id'] });

    if (error) {
      console.error('Error adding to watchlist:', error);
      window.CinePrime?.showToast("Error adding to watchlist.", "error");
      return;
    }

    // Sync local storage replica
    let local = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (!local.includes(movieId)) {
      local.push(movieId);
      localStorage.setItem('watchlist', JSON.stringify(local));
    }

    window.CinePrime?.showToast("Added to watchlist ✅");
    updateWatchlistButtonState(movieId);
  }
}

watchlistBtn?.addEventListener("click", () => {
  const movieId = new URLSearchParams(window.location.search).get("id");
  if (movieId) toggleWatchlist(movieId);
});

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    themeToggle.textContent = '🌙';
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




