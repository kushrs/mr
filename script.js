// Use shared config from supabase-config.js

const supabaseClient = window.supabaseClient;
const API_KEY = window.OMDB_API_KEY;

/* =========================
   DOM
========================= */

const movieGrid = document.getElementById("movie-grid");
const trendingGrid = document.getElementById("trending-grid");
const topRatedGrid = document.getElementById("top-rated-grid");
const genreGrid = document.getElementById("genre-grid");
const recommendationsGrid = document.getElementById("recommendations-grid");
const searchResults = document.getElementById("search-results");

/* =========================
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  loadPopularMovies();
  loadTrending();
  loadTopRatedMovies();
  loadGenreMovies("Action");
  loadRecommendations();
  loadHeroMovie();
  setupGenreTabs();
  setupSearch();
  setupAIMatchmakerChatbot();
});

/* =========================
   MOVIE CARD BRIDGES
   ========================= */

window.addToWatchlist = function(movie) {
  if (movie && movie.imdbID) {
    toggleWatchlist(movie.imdbID);
  }
};



async function updateWatchlistButton(movieId) {
  const button = document.querySelector(`.watchlist-btn[data-movie-id="${movieId}"]`);
  if (!button) return;

  try {
    const isUserAuthenticated = window.supabaseAvailable && window.supabaseClient && (await supabaseClient.auth.getUser()).data.user;
    
    if (!isUserAuthenticated) {
      const localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
      if (localWatchlist.includes(movieId)) {
        button.textContent = "✓ In Watchlist";
        button.classList.add("in-watchlist");
      } else {
        button.textContent = "+ Watchlist";
        button.classList.remove("in-watchlist");
      }
      return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data, error } = await supabaseClient
      .from('watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (!error && data) {
      button.textContent = "✓ In Watchlist";
      button.classList.add("in-watchlist");
    } else {
      button.textContent = "+ Watchlist";
      button.classList.remove("in-watchlist");
    }
  } catch (error) {
    const localWatchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (localWatchlist.includes(movieId)) {
      button.textContent = "✓ In Watchlist";
      button.classList.add("in-watchlist");
    } else {
      button.textContent = "+ Watchlist";
      button.classList.remove("in-watchlist");
    }
  }
}

/* =========================
   WATCHLIST (SUPABASE + LOCALSTORAGE FALLBACK)
   ========================= */

async function toggleWatchlist(movieId) {
  try {
    let isUserAuthenticated = false;
    let user = null;
    
    try {
      if (window.supabaseAvailable && window.supabaseClient) {
        const session = await supabaseClient.auth.getUser();
        user = session?.data?.user;
        isUserAuthenticated = !!user;
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
      updateWatchlistButton(movieId);
      if (typeof loadWatchlist === 'function') loadWatchlist();
      return;
    }

    // Check if movie is already in watchlist
    const { data: existing, error: checkError } = await supabaseClient
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("movie_id", movieId);

    if (checkError) {
      console.error("Error checking watchlist:", checkError);
      window.CinePrime?.showToast("Error checking watchlist status.", "error");
      return;
    }

    if (existing && existing.length > 0) {
      // Remove from watchlist
      const { error: deleteError } = await supabaseClient
        .from("watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", movieId);

      if (deleteError) {
        console.error("Error removing from watchlist:", deleteError);
        window.CinePrime?.showToast("Error removing from watchlist.", "error");
        return;
      }
      
      // Sync local storage replica
      let local = JSON.parse(localStorage.getItem('watchlist') || '[]');
      local = local.filter(id => id !== movieId);
      localStorage.setItem('watchlist', JSON.stringify(local));

      window.CinePrime?.showToast("Removed from watchlist ❌");
      updateWatchlistButton(movieId);
    } else {
      // Add to watchlist
      const { error: insertError } = await supabaseClient
        .from("watchlist")
        .upsert([{ user_id: user.id, movie_id: movieId }], { onConflict: ['user_id', 'movie_id'] });

      if (insertError) {
        console.error("Error adding to watchlist:", insertError);
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
    }

    updateWatchlistButton(movieId);

    // Refresh watchlist self-contained state without full reload
    if (typeof loadWatchlist === 'function') {
      loadWatchlist();
    }
  } catch (error) {
    console.error("Error toggling watchlist:", error);
    window.CinePrime?.showToast("Network error. Syncing failed.", "error");
  }
}

/* =========================
   MOVIE LOADERS
========================= */

async function fetchMovies(query, page = 1) {
  try {
    const res = await fetch(`/api/search?s=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    return data.Response === "True" ? data.Search : [];
  } catch {
    return [];
  }
}

function createSkeletonLoader(count = 6) {
  return `<div class="skeleton-container">` + 
    Array(count).fill('<div class="skeleton-card"></div>').join('') + 
    `</div>`;
}

async function loadPopularMovies() {
  if (!movieGrid) return;
  movieGrid.innerHTML = createSkeletonLoader(6);
  const movies = await fetchMovies("avengers");
  movieGrid.innerHTML = "";
  if (movies.length === 0) {
    movieGrid.innerHTML = "<p class='no-results'>No movies found.</p>";
    return;
  }
  movies.forEach(m => movieGrid.appendChild(createMovieCard(m)));
}

async function loadTrending() {
  if (!trendingGrid) return;
  trendingGrid.innerHTML = createSkeletonLoader(6);
  const movies = await fetchMovies("batman");
  trendingGrid.innerHTML = "";
  if (movies.length === 0) {
    trendingGrid.innerHTML = "<p class='no-results'>No movies found.</p>";
    return;
  }
  movies.forEach(m => trendingGrid.appendChild(createMovieCard(m)));
}

async function loadTopRatedMovies() {
  if (!topRatedGrid) return;
  topRatedGrid.innerHTML = createSkeletonLoader(6);
  const movies = await fetchMovies("dark");
  trendingGrid.innerHTML = ""; // wait, in original it was topRatedGrid! Let's correct that too!
  topRatedGrid.innerHTML = "";
  if (movies.length === 0) {
    topRatedGrid.innerHTML = "<p class='no-results'>No movies found.</p>";
    return;
  }
  movies.forEach(m => topRatedGrid.appendChild(createMovieCard(m)));
}

async function loadGenreMovies(genre) {
  if (!genreGrid) return;
  genreGrid.innerHTML = createSkeletonLoader(6);
  const movies = await fetchMovies(genre);
  genreGrid.innerHTML = "";
  if (movies.length === 0) {
    genreGrid.innerHTML = "<p class='no-results'>No movies found.</p>";
    return;
  }
  movies.forEach(m => genreGrid.appendChild(createMovieCard(m)));
}

/* =========================
   SEARCH
========================= */

function setupSearch() {
  const input = document.getElementById("search");

  input.addEventListener("keyup", async () => {
    const query = input.value.trim();

    if (query.length < 3) return;

    searchResults.innerHTML = "Searching...";

    const movies = await fetchMovies(query);

    searchResults.innerHTML = "";
    movies.forEach(m => searchResults.appendChild(createMovieCard(m)));
  });
}

/* =========================
   HERO
========================= */

const heroMovies = ["batman","inception","interstellar","joker"];

let heroIndex = 0;

async function loadHeroMovie() {
  const heroBg = document.getElementById("hero-bg");
  const heroTitle = document.getElementById("hero-title");

  const movie = await fetchMovies(heroMovies[heroIndex]);

  if (movie[0]) {
    heroTitle.textContent = movie[0].Title;
    heroBg.style.backgroundImage = `url(${movie[0].Poster})`;
  }
}

setInterval(() => {
  heroIndex = (heroIndex + 1) % heroMovies.length;
  loadHeroMovie();
}, 5000);

/* =========================
   RECOMMENDATIONS
========================= */

async function loadRecommendations() {
  if (!recommendationsGrid) return;

  if (recommendationsGrid.innerHTML === "" || recommendationsGrid.innerHTML.includes("Loading")) {
    recommendationsGrid.innerHTML = createSkeletonLoader(6);
  }

  const queries = ["marvel","action","matrix","avatar"];
  const q = queries[Math.floor(Math.random()*queries.length)];

  const movies = await fetchMovies(q);

  recommendationsGrid.innerHTML = "";
  if (movies.length === 0) {
    recommendationsGrid.innerHTML = "<p class='no-results'>No recommendations found.</p>";
    return;
  }
  movies.slice(0,8).forEach(m =>
    recommendationsGrid.appendChild(createMovieCard(m))
  );
}

setInterval(loadRecommendations, 10000);

/* =========================
   THEME
========================= */

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  toggle.onclick = () => {
    document.body.classList.toggle("light-theme");
  };
}

/* =========================
   GENRE TABS
========================= */

function setupGenreTabs() {
  document.querySelectorAll(".genre-tab").forEach(tab => {
    tab.onclick = () => loadGenreMovies(tab.dataset.genre);
  });
}

/* =========================
   AI MOVIE MATCHMAKER CHATBOT
========================= */

function setupAIMatchmakerChatbot() {
  // Build and append Chatbot Widget DOM
  const chatbotContainer = document.createElement('div');
  chatbotContainer.className = 'matchmaker-bot-widget';
  chatbotContainer.innerHTML = `
    <div class="matchmaker-launcher" id="matchmaker-launcher" title="Ask AI Matchmaker!">
      <span class="bot-icon">🤖</span>
      <span class="pulse-ring"></span>
    </div>
    <div class="matchmaker-chat-window" id="matchmaker-chat-window">
      <div class="chat-header">
        <div class="chat-header-title">
          <span class="status-dot"></span>
          <h4>CinePrime Matchmaker</h4>
        </div>
        <div style="display: flex; align-items: center;">
          <button class="chat-close-btn" id="chat-close-btn" style="line-height: 1;">&times;</button>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="chat-message bot">
          <div class="message-bubble">
            👋 Hi! I am your AI Movie Matchmaker. Tell me what kind of movie you're in the mood for, or type keywords like "action thriller" or "sad romance"!
          </div>
        </div>
        <div class="chatbot-suggestions">
          <span class="suggestion-pill" data-query="Sci-Fi Space Adventure">🚀 Sci-Fi Space</span>
          <span class="suggestion-pill" data-query="High Octane Action Thriller">⚡ Action Thriller</span>
          <span class="suggestion-pill" data-query="Hilarious Comedy">😄 Funny Comedy</span>
          <span class="suggestion-pill" data-query="Heartwarming Sad Romance">💖 Sad Romance</span>
        </div>
      </div>
      <div class="chat-input-area">
        <input type="text" id="chat-input" placeholder="Ask for movie recommendations..." autocomplete="off" />
        <button id="chat-send-btn">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(chatbotContainer);

  const launcher = document.getElementById('matchmaker-launcher');
  const chatWindow = document.getElementById('matchmaker-chat-window');
  const closeBtn = document.getElementById('chat-close-btn');
  const sendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');

  let chatbotHistory = [];

  // Listen for suggestion pills clicks
  chatMessages.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion-pill')) {
      const query = e.target.getAttribute('data-query');
      chatInput.value = query;
      handleSendMessage();
      // Remove suggestions after first click to keep chat clean
      const suggestions = chatMessages.querySelector('.chatbot-suggestions');
      if (suggestions) suggestions.remove();
    }
  });

  // Toggle chat window
  launcher.addEventListener('click', () => {
    chatWindow.classList.add('active');
    launcher.style.display = 'none';
    chatInput.focus();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chatWindow.classList.remove('active');
    launcher.style.display = 'flex';
  });

  // Handle messages
  async function handleSendMessage() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Clear input
    chatInput.value = '';

    // Append User Message
    appendMessage(userText, 'user');

    // Show Typing Indicator
    const typingIndicator = showTypingIndicator();

    // Push user message to history
    chatbotHistory.push({ role: 'user', parts: [{ text: userText }] });

    try {
      // Fetch response from serverless/proxy endpoint
      const response = await fetch("/api/matchmaker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ history: chatbotHistory })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      typingIndicator.remove();

      const reply = data.reply || "I couldn't generate a conversational response. Let me show you these movies:";
      const movies = data.movies || [];

      // Push bot response to history
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify(data) }] });

      await appendBotResponse(reply, movies);
      return;

    } catch (apiError) {
      console.warn("Real Gemini AI call failed. Falling back to local conversational engine:", apiError);
    }

    // LOCAL RULE-BASED CONVERSATIONAL FALLBACK
    const lowerQuery = userText.toLowerCase().trim();

    // 1. Check for general conversational greetings
    if (/\b(hi|hello|hey|greetings|yo|sup|good morning|good afternoon)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "Hey there! 🍿 Welcome to CinePrime! I'm your virtual movie matchmaker, ready to help you find your next favorite film or show. What kind of vibe, genre, or mood are you looking for today?";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 2. Check for bot identity/help queries
    if (/\b(who are you|what are you|your name|how do you work|help|what can you do)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "I'm CinePrime's smart movie matchmaker! You can talk to me like a friend—tell me your mood, a genre you like, or ask for something specific (e.g., 'give me a suspenseful thriller' or 'something funny to watch with family'). I'll search the archives and present you with custom carousels instantly!";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 3. Check for joke queries
    if (/\b(joke|funny story|make me laugh|humor)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "Why did the tomato turn red? Because it saw the salad dressing! 🍅 But seriously, if you want some real laughs, try typing 'comedy' and I'll find you some hilarious films!";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 4. Check for favorites queries
    if (/\b(favorite movie|favorite film|your recommendation|best movie)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "I might be an AI, but I have a soft spot for classics! 'Inception' blew my circuits with its dream-within-a-dream concept, and 'Interstellar' has a stellar soundtrack. Try typing 'sci-fi' if you want to explore more mind-bending masterpieces!";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 5. Check for how are you
    if (/\b(how are you|how's it going|how are things|how do you do)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "I'm doing stellar! 🚀 Just cataloging some blockbusters and ready to find you a movie. How are you doing today? What's your movie flavor of choice right now?";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 6. Check for gratitude
    if (/\b(thanks|thank you|awesome|cool|great|perfect|nice)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "You're very welcome! It's my absolute pleasure to help. Let me know if you want to search for another movie or need any more recommendations! Happy watching! 🎬";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 7. Check for farewells
    if (/\b(bye|goodbye|see ya|quit|close)\b/i.test(lowerQuery)) {
      typingIndicator.remove();
      const fallbackReply = "Goodbye! Have an amazing time watching your movies. Don't forget to grab some popcorn! 🍿 See you next time!";
      appendMessage(fallbackReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: fallbackReply, movies: [] }) }] });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 8. If none of the chit-chat fits, perform OMDb Movie Recommendation lookup
    // Mapping common keywords
    const keywordMap = {
      'funny': 'comedy',
      'scary': 'horror',
      'spooky': 'horror',
      'love': 'romance',
      'sad': 'drama',
      'space': 'sci-fi',
      'robot': 'sci-fi',
      'future': 'sci-fi',
      'fight': 'action',
      'explosion': 'action',
      'magic': 'fantasy',
      'wizard': 'fantasy',
      'spies': 'thriller',
      'spy': 'thriller',
      'crime': 'thriller',
      'ghost': 'horror'
    };

    let matchedQuery = '';
    for (const [key, val] of Object.entries(keywordMap)) {
      if (lowerQuery.includes(key)) {
        matchedQuery = val;
        break;
      }
    }

    if (!matchedQuery) {
      // Strip polite phrases to get pure search terms
      matchedQuery = lowerQuery
        .replace(/recommend|suggest|show me|find|search for|please|some|movies|movie|like|about|good|films|film/g, "")
        .trim();
    }

    if (!matchedQuery) {
      matchedQuery = 'action'; // fallback
    }

    // Fetch recommendations from OMDb
    const movies = await fetchMovies(matchedQuery);
    
    // Remove typing indicator
    typingIndicator.remove();

    if (movies && movies.length > 0) {
      // Construct smart conversational intro based on genre/keywords
      let conversationalIntro = "";
      if (matchedQuery === 'action') {
        conversationalIntro = "Aha! Action-packed thrills coming right up. ⚡ Get ready for some high-velocity sequences and heroic stunts. Here are the top action films I found for you:";
      } else if (matchedQuery === 'horror') {
        conversationalIntro = "Ooh, looking for some chills and thrills? Keep the lights on! 👻 I've retrieved these terrifying horror flicks just for you:";
      } else if (matchedQuery === 'comedy') {
        conversationalIntro = "In the mood for some good laughs? Excellent choice. Laughter is the best medicine! 😄 Here are some hilarious movies to brighten your day:";
      } else if (matchedQuery === 'romance') {
        conversationalIntro = "Ah, love is in the air! 💖 Looking for something heartwarming or a beautiful love story? Here are the most romantic films I could find:";
      } else if (matchedQuery === 'sci-fi') {
        conversationalIntro = "Excellent choice! 🚀 Let's explore the cosmos, time travel, and mind-bending future technologies. Here are the top sci-fi adventures in our systems:";
      } else {
        conversationalIntro = `Excellent! I've scanned our cinema catalog for titles related to "${matchedQuery}". Here are the absolute best matches that I highly recommend:`;
      }

      appendRecommendationMessage(conversationalIntro, movies);
      chatbotHistory.push({
        role: "model",
        parts: [{
          text: JSON.stringify({
            reply: conversationalIntro,
            movies: movies.slice(0, 4).map(m => ({ title: m.Title, year: m.Year }))
          })
        }]
      });
    } else {
      const failReply = `Hmm, I couldn't find any direct matches for "${matchedQuery}" in our system. How about we try searching for something else like "Action", "Romance", or "Avengers"?`;
      appendMessage(failReply, 'bot');
      chatbotHistory.push({ role: "model", parts: [{ text: JSON.stringify({ reply: failReply, movies: [] }) }] });
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Send actions
  sendBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });

  // Helpers
  function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.innerHTML = `<div class="message-bubble">${text}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'chat-message bot';
    indicatorDiv.innerHTML = `
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

  function appendRecommendationMessage(text, movies) {
    const container = document.createElement('div');
    container.className = 'chat-message bot';
    
    // Bubble header
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.style.width = '100%';
    bubble.innerHTML = `<p style="margin: 0 0 10px 0;">${text}</p>`;

    // Carousel container
    const carousel = document.createElement('div');
    carousel.className = 'chatbot-carousel';

    // Show top 4 movies
    movies.slice(0, 4).forEach(movie => {
      const card = document.createElement('div');
      card.className = 'chatbot-carousel-card';
      const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://placehold.co/120x180?text=No+Poster';
      card.innerHTML = `
        <img class="chatbot-card-img" src="${poster}" alt="${movie.Title}" />
        <div class="chatbot-card-info">
          <h5>${movie.Title}</h5>
          <p>${movie.Year}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        window.location.href = `movie-details.html?id=${movie.imdbID}`;
      });
      carousel.appendChild(card);
    });

    bubble.appendChild(carousel);
    container.appendChild(bubble);
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function appendBotResponse(replyText, recommendations) {
    const container = document.createElement('div');
    container.className = 'chat-message bot';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.style.width = '100%';
    bubble.innerHTML = `<p style="margin: 0 0 10px 0;">${replyText}</p>`;
    container.appendChild(bubble);
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (recommendations && recommendations.length > 0) {
      const carousel = document.createElement('div');
      carousel.className = 'chatbot-carousel';
      bubble.appendChild(carousel);

      // Add skeletons
      const skeletonCount = Math.min(recommendations.length, 4);
      const skeletons = [];
      for (let i = 0; i < skeletonCount; i++) {
        const skel = document.createElement('div');
        skel.className = 'chatbot-carousel-card skeleton';
        skel.style.minHeight = '180px';
        skel.innerHTML = `
          <div class="chatbot-card-img" style="background: linear-gradient(90deg, rgba(22, 22, 29, 0.6) 25%, rgba(45, 45, 58, 0.6) 37%, rgba(22, 22, 29, 0.6) 63%); background-size: 400% 100%; height: 160px; animation: skeleton-pulse 1.4s ease infinite;"></div>
          <div class="chatbot-card-info" style="padding: 8px;">
            <div style="background: linear-gradient(90deg, rgba(22, 22, 29, 0.6) 25%, rgba(45, 45, 58, 0.6) 37%, rgba(22, 22, 29, 0.6) 63%); background-size: 400% 100%; height: 12px; margin-bottom: 6px; animation: skeleton-pulse 1.4s ease infinite;"></div>
            <div style="background: linear-gradient(90deg, rgba(22, 22, 29, 0.6) 25%, rgba(45, 45, 58, 0.6) 37%, rgba(22, 22, 29, 0.6) 63%); background-size: 400% 100%; height: 10px; width: 50%; animation: skeleton-pulse 1.4s ease infinite;"></div>
          </div>
        `;
        carousel.appendChild(skel);
        skeletons.push(skel);
      }
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Asynchronously fetch movie details from OMDb API for each title
      const playlist = [];
      for (const rec of recommendations.slice(0, 4)) {
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
              playlist.push(details);
            }
          }
        } catch (err) {
          console.warn(`Could not resolve OMDb details for: ${rec.title}`, err);
        }
      }

      // Remove skeletons
      skeletons.forEach(s => s.remove());

      // Append resolved movie cards
      playlist.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'chatbot-carousel-card';
        const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'https://placehold.co/120x180?text=No+Poster';
        card.innerHTML = `
          <img class="chatbot-card-img" src="${poster}" alt="${movie.Title}" onerror="this.src='https://placehold.co/120x180?text=No+Poster'" />
          <div class="chatbot-card-info">
            <h5>${movie.Title}</h5>
            <p>${movie.Year}</p>
          </div>
        `;
        card.addEventListener('click', () => {
          window.location.href = `movie-details.html?id=${movie.imdbID}`;
        });
        carousel.appendChild(card);
      });

      if (playlist.length === 0) {
        carousel.remove();
      }
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}
