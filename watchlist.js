// Use shared config from supabase-config.js
const supabaseClient = window.supabaseClient;
const API_KEY = window.OMDB_API_KEY;

// Collaborative Rooms State
let activeRoomId = new URLSearchParams(window.location.search).get('room') || localStorage.getItem('activeRoomId') || null;

const watchlistGrid = document.getElementById("watchlist-grid");

// Show loading state
function showLoading() {
  watchlistGrid.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p>Loading your watchlist...</p>
    </div>
  `;
}

// Show error state
function showError(message) {
  watchlistGrid.innerHTML = `
    <div class="error-message">
      <h3>Oops! Something went wrong</h3>
      <p>${message}</p>
      <button onclick="loadWatchlist()" class="retry-btn">Try Again</button>
    </div>
  `;
}

// Create movie card with enhanced information
function createMovieCard(data) {
  const card = document.createElement("div");
  card.className = "movie-card";
  card.setAttribute('data-imdb-id', data.imdbID);

  // Thumbnail container
  const thumbnailContainer = document.createElement("div");
  thumbnailContainer.className = "movie-thumbnail-container";

  const thumbnail = document.createElement("img");
  thumbnail.className = "movie-thumbnail";
  thumbnail.src = data.Poster && data.Poster !== "N/A" ? data.Poster : 'https://placehold.co/300x450?text=No+Image';
  thumbnail.onerror = function() { this.onerror = null; this.src = 'https://placehold.co/300x450?text=No+Image'; };
  thumbnail.alt = data.Title;
  thumbnail.loading = "lazy";
  thumbnailContainer.appendChild(thumbnail);

  // Info overlay
  const info = document.createElement("div");
  info.className = "movie-info";

  const title = document.createElement("h3");
  title.textContent = data.Title || "Untitled";
  info.appendChild(title);

  // Meta (year, rating)
  const meta = document.createElement("div");
  meta.className = "movie-meta";
  const year = document.createElement("span");
  year.className = "year";
  year.textContent = data.Year || "";
  meta.appendChild(year);
  const rating = document.createElement("span");
  rating.className = "rating";
  rating.innerHTML = `★ ${data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : "N/A"}`;
  meta.appendChild(rating);
  info.appendChild(meta);

  // Genre
  if (data.Genre && data.Genre !== "N/A") {
    const genre = document.createElement("p");
    genre.className = "genre";
    genre.textContent = data.Genre;
    info.appendChild(genre);
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "watchlist-actions";
  const detailsBtn = document.createElement("button");
  detailsBtn.className = "view-details-btn";
  detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i> Details';
  detailsBtn.onclick = () => window.location.href = `movie-details.html?id=${data.imdbID}`;
  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
  removeBtn.onclick = () => removeFromWatchlist(data.imdbID);
  actions.appendChild(detailsBtn);
  actions.appendChild(removeBtn);
  info.appendChild(actions);

  card.appendChild(thumbnailContainer);
  card.appendChild(info);
  return card;
}

// Load watchlist with error handling, loading states, offline caching, and rooms
async function loadWatchlist(){
  const container = document.getElementById("watchlist-grid");
  
  if (!container) {
    console.error("watchlist-grid element not found");
    return;
  }

  showLoading();

  // If a room is active, load collaborative room instead
  if (activeRoomId) {
    await loadCollaborativeRoom();
    return;
  }

  let user = null;
  try {
    const session = await supabaseClient.auth.getUser();
    user = session?.data?.user;
  } catch (e) {
    console.warn("Auth check failed:", e);
  }

  if(!user){
    // Fallback to local watchlist items or local storage cache
    const localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (localWatchlist.length > 0) {
      await loadOfflineWatchlist(localWatchlist);
    } else {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:50px; color:#cbd5e1;">
          <h3>Not Logged In</h3>
          <p style="margin-bottom: 20px; color: #94a3b8;">Please login to sync your watchlist, or add movies on the Home page.</p>
          <a href="login.html" class="btn" style="display:inline-block; text-decoration:none; padding:10px 20px; background:var(--primary-color); border-radius:5px; color:#fff;">Go to Login</a>
        </div>
      `;
    }
    return;
  }

  let isOffline = true;
  let data = [];

  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      const res = await supabaseClient
        .from("watchlist")
        .select("*")
        .eq("user_id", user.id);
      
      if (!res.error && res.data) {
        data = res.data;
        isOffline = false;
        // Cache this watchlist
        localStorage.setItem('cached_watchlist', JSON.stringify(data));
      }
    }
  } catch (error) {
    console.warn("Watchlist fetch failed, falling back to cache:", error);
  }

  if (isOffline) {
    console.log("Loading watchlist from offline cache...");
    data = JSON.parse(localStorage.getItem('cached_watchlist') || '[]');
  }

  container.innerHTML = "";

  // Show empty message if no movies
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-message" style="grid-column: 1 / -1;">
        <div class="empty-content">
          <h3>Your watchlist is empty</h3>
          <p>Explore movies and TV shows to build your personal watchlist!</p>
          <a href="index.html" class="btn" style="text-decoration:none;">Discover Movies</a>
        </div>
      </div>
    `;
    return;
  }

  const uniqueWatchlistItems = [...new Map(data
    .filter((item) => item && item.movie_id)
    .map((item) => [item.movie_id.trim().toLowerCase(), item])
    ).values()];

  const fetchPromises = uniqueWatchlistItems.map((item) =>
    fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${item.movie_id}`)
      .then((res) => res.json())
      .catch((err) => {
        console.error("Error fetching movie:", err);
        return null;
      })
  );

  const movieResponses = await Promise.all(fetchPromises);
  const renderedMovieIds = new Set();

  movieResponses.forEach((movie) => {
    if (movie && movie.Response === "True" && !renderedMovieIds.has(movie.imdbID)) {
      container.appendChild(createMovieCard(movie));
      renderedMovieIds.add(movie.imdbID);
    }
  });
}

// Load private watchlist while offline
async function loadOfflineWatchlist(imdbIds) {
  const container = document.getElementById("watchlist-grid");
  container.innerHTML = "";

  const fetchPromises = imdbIds.map((id) =>
    fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${id}`)
      .then((res) => res.json())
      .catch(() => null)
  );

  const movieResponses = await Promise.all(fetchPromises);
  movieResponses.forEach((movie) => {
    if (movie && movie.Response === "True") {
      container.appendChild(createMovieCard(movie));
    }
  });
}

// Remove from private watchlist
async function removeFromWatchlist(movieId) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      // Local watchlist removal fallback
      let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
      watchlist = watchlist.filter(id => id !== movieId);
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
      
      if (window.CinePrime?.showToast) {
        window.CinePrime.showToast("Removed from local watchlist ❌");
      } else {
        alert("Removed from watchlist");
      }
      
      loadWatchlist();
      return;
    }

    const { error } = await supabaseClient
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("movie_id", movieId);

    if (error) throw error;
    
    // Sync local storage replica
    let local = JSON.parse(localStorage.getItem('watchlist') || '[]');
    local = local.filter(id => id !== movieId);
    localStorage.setItem('watchlist', JSON.stringify(local));

    if (window.CinePrime?.showToast) {
      window.CinePrime.showToast("Removed from watchlist ❌");
    } else {
      alert("Removed from watchlist");
    }
    
    loadWatchlist(); // Reload the watchlist
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    if (window.CinePrime?.showToast) {
      window.CinePrime.showToast("Error removing movie from watchlist", "error");
    } else {
      alert("Error removing movie from watchlist");
    }
  }
}

/* =========================
   COLLABORATIVE WATCHLIST ROOMS LOGIC
========================= */

async function loadCollaborativeRoom() {
  const container = document.getElementById("watchlist-grid");
  const activeRoomInfo = document.getElementById("active-room-info");
  const activeRoomIdSpan = document.getElementById("active-room-id");
  const roomActionsArea = document.getElementById("room-actions-area");

  if (activeRoomInfo) activeRoomInfo.style.display = "flex";
  if (activeRoomIdSpan) activeRoomIdSpan.textContent = activeRoomId;
  if (roomActionsArea) roomActionsArea.style.display = "none";

  let items = [];
  let isOffline = true;

  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      const { data, error } = await supabaseClient
        .from("shared_watchlist_items")
        .select("*")
        .eq("room_id", activeRoomId);

      if (!error && data) {
        items = data;
        isOffline = false;
      }
    }
  } catch (err) {
    console.warn("Collaborative room fetch failed, falling back to local mock room:", err);
  }

  if (isOffline) {
    items = JSON.parse(localStorage.getItem(`mock_room_${activeRoomId}`) || '[]');
  }

  container.innerHTML = "";

  // Add the search add bar inside the room
  const searchRow = document.createElement("div");
  searchRow.style.gridColumn = "1 / -1";
  searchRow.style.marginBottom = "24px";
  searchRow.style.display = "flex";
  searchRow.style.justifyContent = "center";
  searchRow.innerHTML = `
    <div class="join-room-box" style="width: 100%; max-width: 600px;">
      <input type="text" id="add-room-movie-input" placeholder="Search and add movie to room (e.g. Inception)..." autocomplete="off" />
      <button id="add-room-movie-btn" class="btn collab-btn">Add Movie</button>
    </div>
  `;
  container.appendChild(searchRow);

  // Hook up event listeners for add form
  const addInput = searchRow.querySelector("#add-room-movie-input");
  const addBtn = searchRow.querySelector("#add-room-movie-btn");
  
  addBtn.onclick = () => addMovieToRoom(addInput);
  addInput.onkeypress = (e) => {
    if (e.key === "Enter") addMovieToRoom(addInput);
  };

  if (items.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.style.gridColumn = "1 / -1";
    emptyRow.style.textAlign = "center";
    emptyRow.style.padding = "40px";
    emptyRow.style.color = "#94a3b8";
    emptyRow.innerHTML = `<h3>This room is empty. Start adding movies above!</h3>`;
    container.appendChild(emptyRow);
    return;
  }

  // Sort items by votes descending
  items.sort((a, b) => (b.votes || 0) - (a.votes || 0));

  const moviePromises = items.map(item => 
    fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${item.movie_id}`)
      .then(res => res.json())
      .then(movie => {
        if (movie && movie.Response === "True") {
          return { ...movie, roomItem: item };
        }
        return null;
      })
      .catch(() => null)
  );

  const movies = await Promise.all(moviePromises);

  movies.forEach(movie => {
    if (!movie) return;
    const card = createMovieCard(movie);
    
    // Replace action button with vote panel
    const infoDiv = card.querySelector(".movie-info");
    const actionsDiv = card.querySelector(".watchlist-actions");
    if (actionsDiv) actionsDiv.remove();

    // Create vote panel
    const votePanel = document.createElement("div");
    votePanel.className = "room-vote-panel";

    const userVotes = JSON.parse(localStorage.getItem("user_votes") || "{}");
    const userVote = userVotes[`${activeRoomId}_${movie.imdbID}`] || null;

    votePanel.innerHTML = `
      <span class="vote-score">${movie.roomItem.votes || 0} votes</span>
      <div class="vote-controls">
        <button class="vote-btn ${userVote === 'up' ? 'upvoted' : ''}" id="upvote-${movie.imdbID}">👍</button>
        <button class="vote-btn ${userVote === 'down' ? 'downvoted' : ''}" id="downvote-${movie.imdbID}">👎</button>
      </div>
    `;

    votePanel.querySelector(`#upvote-${movie.imdbID}`).onclick = (e) => voteMovie(movie.imdbID, 'up', e);
    votePanel.querySelector(`#downvote-${movie.imdbID}`).onclick = (e) => voteMovie(movie.imdbID, 'down', e);

    infoDiv.appendChild(votePanel);
    container.appendChild(card);
  });
}

// Add Movie to Room
async function addMovieToRoom(inputField) {
  const title = inputField.value.trim();
  if (!title) return;

  inputField.value = "Searching...";
  inputField.disabled = true;

  try {
    const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${API_KEY}`);
    const data = await res.json();

    if (data.Response === "True" && data.Search && data.Search.length > 0) {
      const bestMatch = data.Search[0];
      const imdbId = bestMatch.imdbID;

      const itemEntry = {
        room_id: activeRoomId,
        movie_id: imdbId,
        votes: 1,
        created_at: new Date().toISOString()
      };

      let isOffline = true;

      try {
        if (window.supabaseAvailable && window.supabaseClient) {
          const { error } = await supabaseClient
            .from("shared_watchlist_items")
            .insert([itemEntry]);

          if (!error) isOffline = false;
        }
      } catch (err) {
        console.warn("Supabase shared watchlist insert failed, saving locally:", err);
      }

      if (isOffline) {
        const mockRoomData = JSON.parse(localStorage.getItem(`mock_room_${activeRoomId}`) || '[]');
        if (!mockRoomData.some(m => m.movie_id === imdbId)) {
          mockRoomData.push(itemEntry);
          localStorage.setItem(`mock_room_${activeRoomId}`, JSON.stringify(mockRoomData));
        }
      }

      // Record upvote automatically
      const userVotes = JSON.parse(localStorage.getItem("user_votes") || "{}");
      userVotes[`${activeRoomId}_${imdbId}`] = 'up';
      localStorage.setItem("user_votes", JSON.stringify(userVotes));

      alert(`Added "${bestMatch.Title}" to Collaborative Room!`);
    } else {
      alert("Movie not found. Please try another title!");
    }
  } catch (err) {
    console.error("Error adding room movie:", err);
    alert("Error adding movie to room.");
  }

  loadWatchlist();
}

// Vote on a movie in a room
async function voteMovie(movieId, direction, event) {
  if (event) event.stopPropagation();

  const userVotes = JSON.parse(localStorage.getItem("user_votes") || "{}");
  const currentVote = userVotes[`${activeRoomId}_${movieId}`] || null;

  let voteDiff = 0;
  if (currentVote === direction) {
    // Revoke vote
    userVotes[`${activeRoomId}_${movieId}`] = null;
    voteDiff = direction === 'up' ? -1 : 1;
  } else {
    // Change vote
    userVotes[`${activeRoomId}_${movieId}`] = direction;
    if (currentVote === null) {
      voteDiff = direction === 'up' ? 1 : -1;
    } else {
      voteDiff = direction === 'up' ? 2 : -2;
    }
  }

  localStorage.setItem("user_votes", JSON.stringify(userVotes));

  let isOffline = true;

  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      const { data, error } = await supabaseClient
        .from("shared_watchlist_items")
        .select("votes")
        .eq("room_id", activeRoomId)
        .eq("movie_id", movieId)
        .maybeSingle();

      if (!error && data) {
        const newVotes = (data.votes || 0) + voteDiff;
        await supabaseClient
          .from("shared_watchlist_items")
          .update({ votes: newVotes })
          .eq("room_id", activeRoomId)
          .eq("movie_id", movieId);
        
        isOffline = false;
      }
    }
  } catch (err) {
    console.warn("Supabase shared watchlist voting failed, voting locally:", err);
  }

  if (isOffline) {
    const mockRoomData = JSON.parse(localStorage.getItem(`mock_room_${activeRoomId}`) || '[]');
    const index = mockRoomData.findIndex(m => m.movie_id === movieId);
    if (index !== -1) {
      mockRoomData[index].votes = (mockRoomData[index].votes || 0) + voteDiff;
      localStorage.setItem(`mock_room_${activeRoomId}`, JSON.stringify(mockRoomData));
    }
  }

  loadWatchlist();
}

// Room controllers
function createRoom() {
  const roomId = 'R-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  activeRoomId = roomId;
  localStorage.setItem('activeRoomId', roomId);
  
  // Set mock room locally
  localStorage.setItem(`mock_room_${roomId}`, JSON.stringify([]));

  // Sync to URL
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  window.history.pushState({}, '', url);

  loadWatchlist();
}

function joinRoom() {
  const input = document.getElementById("room-id-input");
  if (!input) return;
  const roomId = input.value.trim().toUpperCase();
  if (!roomId) return;

  activeRoomId = roomId;
  localStorage.setItem('activeRoomId', roomId);

  // Sync to URL
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  window.history.pushState({}, '', url);

  loadWatchlist();
}

function leaveRoom() {
  activeRoomId = null;
  localStorage.removeItem('activeRoomId');

  // Sync to URL
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.pushState({}, '', url);

  // Reset elements
  const activeRoomInfo = document.getElementById("active-room-info");
  const roomActionsArea = document.getElementById("room-actions-area");
  if (activeRoomInfo) activeRoomInfo.style.display = "none";
  if (roomActionsArea) roomActionsArea.style.display = "flex";

  loadWatchlist();
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  loadWatchlist();

  // Set up Room Button click listeners
  const createRoomBtn = document.getElementById("create-room-btn");
  const joinRoomBtn = document.getElementById("join-room-btn");
  const leaveRoomBtn = document.getElementById("leave-room-btn");
  const roomIdInput = document.getElementById("room-id-input");

  if (createRoomBtn) createRoomBtn.onclick = createRoom;
  if (joinRoomBtn) joinRoomBtn.onclick = joinRoom;
  if (leaveRoomBtn) leaveRoomBtn.onclick = leaveRoom;
  if (roomIdInput) {
    roomIdInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") joinRoom();
    });
  }
  
  // Theme toggle functionality
  const themeToggle = document.getElementById("theme-toggle");
  const currentTheme = localStorage.getItem("theme") || "dark";
  document.body.classList.toggle("light-theme", currentTheme === "light");
  themeToggle.textContent = currentTheme === "light" ? "🌙" : "☀️";

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeToggle.textContent = isLight ? "🌙" : "☀️";
  });
});
