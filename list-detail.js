// list-detail.js
// Requires components.js

const urlParams = new URLSearchParams(window.location.search);
const listId = urlParams.get("id");
const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
const listTitle = document.getElementById("list-title");
const listDescription = document.getElementById("list-description");
const grid = document.getElementById("list-movies-grid");
const emptyMessage = document.getElementById("empty-list-message");

function loadListDetail() {
  if (!currentUser || !listId) {
    window.location.href = "lists.html";
    return;
  }
  // For demo: get lists from localStorage (replace with API if needed)
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const list = userLists.find(l => l.id == listId);
  if (!list) {
    window.location.href = "lists.html";
    return;
  }
  listTitle.textContent = list.name;
  listDescription.textContent = list.description || '';
  if (!list.movies || list.movies.length === 0) {
    grid.style.display = "none";
    emptyMessage.style.display = "block";
    return;
  }
  grid.style.display = "grid";
  emptyMessage.style.display = "none";
  grid.innerHTML = "";
  Promise.all(list.movies.map(movieId =>
    fetch(`https://www.omdbapi.com/?i=${movieId}&apikey=8ddfd56d`).then(res => res.json())
  )).then(movies => {
    movies.forEach(movie => {
      grid.appendChild(createMovieCard(movie));
    });
  });
}

document.addEventListener("DOMContentLoaded", loadListDetail); 