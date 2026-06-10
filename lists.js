document.addEventListener("DOMContentLoaded", () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  if (!currentUser) {
    window.location.href = "login.html?redirect=lists.html";
    return;
  }
  
  setupThemeToggle();
  setupModals();
  loadUserLists();
  
  document.getElementById("create-list-form").addEventListener("submit", createList);
  document.getElementById("edit-list-form").addEventListener("submit", saveListChanges);
  document.getElementById("create-list-btn").addEventListener("click", () => {
    document.getElementById("create-list-modal").style.display = "block";
  });
  document.getElementById("create-first-list-btn").addEventListener("click", () => {
    document.getElementById("create-list-modal").style.display = "block";
  });
});

function setupModals() {
  document.querySelectorAll(".close-modal").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".modal").forEach(modal => {
        modal.style.display = "none";
      });
    });
  });
  
  window.addEventListener("click", (event) => {
    document.querySelectorAll(".modal").forEach(modal => {
      if (event.target === modal) modal.style.display = "none";
    });
  });
}

function loadUserLists() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) return;

  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const listsContainer = document.getElementById("lists-container");
  const emptyLists = document.getElementById("empty-lists");

  if (userLists.length === 0) {
    emptyLists.style.display = "block";
    listsContainer.style.display = "none";
    return;
  } else {
    emptyLists.style.display = "none";
    listsContainer.style.display = "block";
  }

  listsContainer.innerHTML = "";

  userLists.forEach(list => {
    const listElement = document.createElement("div");
    listElement.className = "list-card";
    listElement.setAttribute("data-id", list.id);
    const movieCount = list.movies ? list.movies.length : 0;
    const privacyIcon = list.privacy === "private" ? "🔒" : "🌐";
    listElement.innerHTML = `
      <div class="list-header">
        <h3>${list.name}</h3>
        <span class="list-privacy" title="${list.privacy === 'private' ? 'Private list' : 'Public list'}">${privacyIcon}</span>
      </div>
      <p class="list-description">${list.description || 'No description'}</p>
      <div class="list-stats">
        <span>${movieCount} ${movieCount === 1 ? 'movie' : 'movies'}</span>
        <span>Created ${new Date(list.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="list-preview"></div>
      <div class="list-actions">
        <button class="view-list-btn">View</button>
        <button class="edit-list-btn">Edit</button>
        <button class="delete-list-btn">Delete</button>
      </div>
    `;
    listElement.querySelector(".view-list-btn").addEventListener("click", () => viewList(list.id));
    listElement.querySelector(".edit-list-btn").addEventListener("click", () => openEditListModal(list));
    listElement.querySelector(".delete-list-btn").addEventListener("click", () => deleteList(list.id));
    listsContainer.appendChild(listElement);
    loadListPreviews(list, listElement.querySelector(".list-preview"));
  });
}

function loadListPreviews(list, previewContainer) {
  if (!list.movies?.length) {
    previewContainer.innerHTML = '<p class="empty-preview">No movies in this list yet</p>';
    return;
  }
  
  const previewMovies = list.movies.slice(0, 4);
  
  Promise.all(previewMovies.map(movieId => 
    fetch(`https://www.omdbapi.com/?i=${movieId}&apikey=${API_KEY}`).then(res => res.json())
  ))
  .then(movies => {
    previewContainer.innerHTML = "";
    
    movies.forEach(movie => {
      const poster = movie.Poster !== "N/A" ? movie.Poster : "https://placehold.co/100x150?text=No+Image";
      const posterElement = document.createElement("div");
      posterElement.className = "preview-poster";
      posterElement.innerHTML = `<img src="${poster}" alt="${movie.Title}" title="${movie.Title}" onerror="this.onerror=null;this.src='https://placehold.co/100x150?text=No+Image';">`;
      previewContainer.appendChild(posterElement);
    });
    
    if (list.movies.length > 4) {
      const moreElement = document.createElement("div");
      moreElement.className = "preview-more";
      moreElement.innerHTML = `<span>+${list.movies.length - 4} more</span>`;
      previewContainer.appendChild(moreElement);
    }
  })
  .catch(() => {
    previewContainer.innerHTML = '<p class="empty-preview">Error loading previews</p>';
  });
}

function createList(e) {
  e.preventDefault();
  const name = document.getElementById("list-name").value;
  const description = document.getElementById("list-description").value;
  const privacy = document.getElementById("list-privacy").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const newList = {
    id: Date.now().toString(),
    name,
    description,
    privacy,
    user: currentUser.id,
    movies: [],
    createdAt: new Date().toISOString()
  };
  userLists.push(newList);
  localStorage.setItem(`user-lists-${currentUser.id}`, JSON.stringify(userLists));
  document.getElementById("create-list-modal").style.display = "none";
  document.getElementById("create-list-form").reset();
  loadUserLists();
}

function openEditListModal(list) {
  document.getElementById("edit-list-id").value = list.id;
  document.getElementById("edit-list-name").value = list.name;
  document.getElementById("edit-list-description").value = list.description || '';
  document.getElementById("edit-list-privacy").value = list.privacy;
  document.getElementById("edit-list-modal").style.display = "block";
}

function saveListChanges(e) {
  e.preventDefault();
  
  const listId = document.getElementById("edit-list-id").value;
  const name = document.getElementById("edit-list-name").value;
  const description = document.getElementById("edit-list-description").value;
  const privacy = document.getElementById("edit-list-privacy").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const listIndex = userLists.findIndex(list => list.id === listId);
  
  if (listIndex === -1) return;
  
  userLists[listIndex].name = name;
  userLists[listIndex].description = description;
  userLists[listIndex].privacy = privacy;
  userLists[listIndex].updatedAt = new Date().toISOString();
  
  localStorage.setItem(`user-lists-${currentUser.id}`, JSON.stringify(userLists));
  document.getElementById("edit-list-modal").style.display = "none";
  loadUserLists();
}

function deleteList(listId) {
  if (!confirm("Are you sure you want to delete this list? This action cannot be undone.")) return;
  
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  userLists = userLists.filter(list => list.id !== listId);
  localStorage.setItem(`user-lists-${currentUser.id}`, JSON.stringify(userLists));
  loadUserLists();
}

function viewList(listId) {
  window.location.href = `list-detail.html?id=${listId}`;
}

function addMovieToList(movieId, listId) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const listIndex = userLists.findIndex(list => list.id === listId);
  
  if (listIndex === -1 || userLists[listIndex].movies.includes(movieId)) return;
  
  userLists[listIndex].movies.push(movieId);
  userLists[listIndex].updatedAt = new Date().toISOString();
  localStorage.setItem(`user-lists-${currentUser.id}`, JSON.stringify(userLists));
}

function removeMovieFromList(movieId, listId) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser")) || JSON.parse(sessionStorage.getItem("currentUser"));
  let userLists = JSON.parse(localStorage.getItem(`user-lists-${currentUser.id}`)) || [];
  const listIndex = userLists.findIndex(list => list.id === listId);
  
  if (listIndex === -1) return;
  
  userLists[listIndex].movies = userLists[listIndex].movies.filter(id => id !== movieId);
  userLists[listIndex].updatedAt = new Date().toISOString();
  localStorage.setItem(`user-lists-${currentUser.id}`, JSON.stringify(userLists));
}