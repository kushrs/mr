// matchmaker.js - Conversational AI Movie Curator Logic

let chatHistory = [];
let userWatchlistIds = [];

document.addEventListener("DOMContentLoaded", async () => {
  setupChatInterface();
  setupPresetPills();
  await fetchUserWatchlist();
});

// 1. Pre-Fetch Watchlist IDs
async function fetchUserWatchlist() {
  try {
    if (window.supabaseAvailable && window.supabaseClient) {
      const currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser'));
      if (currentUser) {
        const { data, error } = await supabaseClient
          .from('watchlist')
          .select('movie_id')
          .eq('user_id', currentUser.id);
        if (!error && data) {
          userWatchlistIds = data.map(item => item.movie_id);
          return;
        }
      }
    }
  } catch (e) {
    console.warn("Could not pre-fetch user watchlist:", e);
  }
  userWatchlistIds = JSON.parse(localStorage.getItem('watchlist') || '[]');
}

// 2. Watchlist Toggler
async function toggleWatchlist(movieId) {
  try {
    let isUserAuthenticated = false;
    let currentUser = null;
    
    try {
      if (window.supabaseAvailable && window.supabaseClient) {
        currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser'));
        isUserAuthenticated = !!currentUser;
      }
    } catch (e) {
      console.warn("Watchlist auth pre-check failed:", e);
    }

    if (!isUserAuthenticated) {
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
      userWatchlistIds = localWatchlist;
      return;
    }

    const { data: existing, error: checkError } = await supabaseClient
      .from("watchlist")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("movie_id", movieId);

    if (checkError) {
      console.error("Error checking watchlist:", checkError);
      window.CinePrime?.showToast("Error checking watchlist status.", "error");
      return;
    }

    if (existing && existing.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from("watchlist")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("movie_id", movieId);

      if (deleteError) {
        console.error("Error removing from watchlist:", deleteError);
        window.CinePrime?.showToast("Error removing from watchlist.", "error");
        return;
      }
      window.CinePrime?.showToast("Removed from watchlist ❌");
      const idx = userWatchlistIds.indexOf(movieId);
      if (idx > -1) userWatchlistIds.splice(idx, 1);
    } else {
      const { error: insertError } = await supabaseClient
        .from("watchlist")
        .upsert([{ user_id: currentUser.id, movie_id: movieId }], { onConflict: ['user_id', 'movie_id'] });

      if (insertError) {
        console.error("Error adding to watchlist:", insertError);
        window.CinePrime?.showToast("Error adding to watchlist.", "error");
        return;
      }
      window.CinePrime?.showToast("Added to watchlist ✅");
      if (!userWatchlistIds.includes(movieId)) userWatchlistIds.push(movieId);
    }
  } catch (error) {
    console.error("Error toggling watchlist:", error);
    window.CinePrime?.showToast("Network error. Syncing failed.", "error");
  }
}

// 3. Setup Chat Interface Events
function setupChatInterface() {
  const sendBtn = document.getElementById("chat-send-btn");
  const chatInput = document.getElementById("chat-input");
  const clearBtn = document.getElementById("clear-chat-btn");

  if (sendBtn) {
    sendBtn.addEventListener("click", handleUserMessage);
  }

  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleUserMessage();
      }
    });

    // Auto grow textarea height
    chatInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", clearChatHistory);
  }
}

// 4. Setup Presets
function setupPresetPills() {
  const pills = document.querySelectorAll(".preset-pill");
  const chatInput = document.getElementById("chat-input");

  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      const promptText = pill.getAttribute("data-prompt");
      if (chatInput) {
        chatInput.value = promptText;
        chatInput.style.height = "auto";
        handleUserMessage();
      }
    });
  });
}

// 5. Handle Send Message
async function handleUserMessage() {
  const chatInput = document.getElementById("chat-input");
  if (!chatInput) return;

  const userText = chatInput.value.trim();
  if (!userText) return;

  // Clear Input
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Append user bubble
  appendMessage(userText, "user");

  // Push user state to chat history
  chatHistory.push({ role: "user", parts: [{ text: userText }] });

  // Show Typing Indicator
  const typingIndicator = appendTypingIndicator();

  try {
    // Send to backend matchmaker endpoint
    const response = await fetch("/api/matchmaker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ history: chatHistory })
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    
    // Remove Typing Indicator
    typingIndicator.remove();

    const reply = data.reply || "I couldn't generate a conversational response. Let me show you these movies:";
    const movies = data.movies || [];

    // Push bot response to history
    chatHistory.push({ role: "model", parts: [{ text: JSON.stringify(data) }] });

    // Render bot bubble
    await appendBotResponse(reply, movies);

  } catch (error) {
    console.error("Curator query failed:", error);
    typingIndicator.remove();
    appendMessage("Oops, I encountered a communication error with my recommendation brain. Please check your internet connection and try again! 🤖", "bot");
  }
}

// 6. Message Render Helper
function appendMessage(text, sender) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message ${sender}`;

  const avatar = sender === "bot" ? "🤖" : "👤";
  
  msgDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-bubble">
      <p>${text}</p>
    </div>
  `;

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msgDiv;
}

// 7. Bot Conversational & Card Render Builder
async function appendBotResponse(replyText, recommendations) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-message bot";

  // Bubble wrapper
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.style.width = "100%";
  bubble.innerHTML = `<p>${replyText}</p>`;

  msgDiv.appendChild(bubble);
  
  // Set up avatar
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "🤖";
  msgDiv.insertBefore(avatar, bubble);
  
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Render Skeleton Loader if there are recommended movies
  if (recommendations && recommendations.length > 0) {
    const skeletonContainer = document.createElement("div");
    skeletonContainer.className = "chat-skeleton-container";
    skeletonContainer.innerHTML = Array(3).fill('<div class="chat-skeleton-card"></div>').join('');
    bubble.appendChild(skeletonContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Fetch details & render carousel cards asynchronously
    const playlist = [];
    await fetchUserWatchlist(); // Sync watchlist details first

    for (const rec of recommendations) {
      try {
        let searchUrl = `/api/omdb?t=${encodeURIComponent(rec.title)}`;
        if (rec.year) {
          const yearClean = String(rec.year).substring(0, 4);
          searchUrl += `&y=${yearClean}`;
        }
        
        const detailsRes = await fetch(searchUrl);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          if (details && details.Response === "True") {
            playlist.push({
              ...details,
              insight: rec.curator_insight || "A highly recommended movie matching your chat preferences."
            });
          }
        }
      } catch (err) {
        console.warn(`Could not resolve OMDb details in chat for: ${rec.title}`, err);
      }
    }

    // Remove skeletons
    skeletonContainer.remove();

    if (playlist.length > 0) {
      const carousel = document.createElement("div");
      carousel.className = "chat-carousel";

      playlist.forEach(movie => {
        const card = createChatMovieCard(movie, movie.insight);
        carousel.appendChild(card);
      });

      bubble.appendChild(carousel);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// 8. Custom Movie Card for Chat Carousel
function createChatMovieCard(movie, insight) {
  const card = document.createElement("div");
  card.className = "chat-card";

  const poster = movie.Poster && movie.Poster !== "N/A" ? movie.Poster : "https://placehold.co/150x220?text=No+Poster";
  const isInWatchlist = userWatchlistIds.includes(movie.imdbID);

  card.innerHTML = `
    <div class="chat-card-horizontal">
      <img class="chat-card-poster" src="${poster}" alt="${movie.Title}" onerror="this.src='https://placehold.co/150x220?text=No+Poster'" />
      <div class="chat-card-metadata">
        <div>
          <h4>${movie.Title}</h4>
          <div class="chat-card-tags">
            <span>${movie.Year}</span>
            <span>•</span>
            <span class="chat-card-rating">★ ${movie.imdbRating && movie.imdbRating !== "N/A" ? movie.imdbRating : "N/A"}</span>
          </div>
        </div>
        <div class="chat-card-actions">
          <button class="btn details-btn" id="details-${movie.imdbID}">Details</button>
          <button class="btn secondary-btn watchlist-btn" data-movie-id="${movie.imdbID}" id="watchlist-${movie.imdbID}">
            ${isInWatchlist ? "✓ Added" : "+ Watchlist"}
          </button>
        </div>
      </div>
    </div>
    <div class="chat-card-insight">
      ${insight}
    </div>
  `;

  // Bind Details Button
  card.querySelector(`#details-${movie.imdbID}`).addEventListener("click", () => {
    window.location.href = `movie-details.html?id=${movie.imdbID}`;
  });

  // Bind Watchlist toggle action
  const watchlistBtn = card.querySelector(`#watchlist-${movie.imdbID}`);
  watchlistBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    
    await toggleWatchlist(movie.imdbID);
    const isInList = userWatchlistIds.includes(movie.imdbID);
    watchlistBtn.textContent = isInList ? "✓ Added" : "+ Watchlist";
  });

  return card;
}

// 9. Append Typing Indicator
function appendTypingIndicator() {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return null;

  const indicatorDiv = document.createElement("div");
  indicatorDiv.className = "chat-message bot";
  indicatorDiv.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-bubble">
      <div class="chat-typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  chatMessages.appendChild(indicatorDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return indicatorDiv;
}

// 10. Clear Chat History
function clearChatHistory() {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="chat-message bot">
      <div class="message-avatar">🤖</div>
      <div class="message-bubble">
        <p>Hello! I am your CinePrime AI Movie Curator. Let's talk about movies! 🎬</p>
        <p>Tell me what vibe you're looking for, ask a specific question, or describe your current mood (e.g. <em>"Give me something funny to watch on a rainy night"</em> or <em>"Suggest sci-fi movies similar to Inception"</em>). I'll find the perfect match for you!</p>
      </div>
    </div>
  `;
  window.CinePrime?.showToast("Chat history cleared 🗑️");
}
