function loadContinueWatching() {
  const row = document.getElementById("continue-watching-row");
  row.innerHTML = "";
  // Example: get movie IDs from localStorage (simulate progress)
  const progress = JSON.parse(localStorage.getItem("continueWatching") || "[]");
  if (progress.length === 0) {
    row.innerHTML = "<p>No movies to continue.</p>";
    return;
  }
  progress.forEach(movie => {
    // You can fetch movie details from your backend or OMDb here
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <h4>${movie.title}</h4>
      <button onclick="window.location.href='movie-details.html?id=${movie.imdb_id}'">Resume</button>
    `;
    row.appendChild(card);
  });
}

function addToContinueWatching(movie) {
  let progress = JSON.parse(localStorage.getItem("continueWatching") || "[]");
  // Remove if already exists
  progress = progress.filter(m => m.imdb_id !== movie.imdb_id);
  progress.unshift(movie); // Add to front
  if (progress.length > 10) progress = progress.slice(0, 10); // Keep only 10
  localStorage.setItem("continueWatching", JSON.stringify(progress));
}

// Call this on page load
document.addEventListener("DOMContentLoaded", loadContinueWatching);