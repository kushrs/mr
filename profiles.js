document.addEventListener("DOMContentLoaded", () => {
  let profiles = JSON.parse(localStorage.getItem("cineprime-profiles") || "[]");
  const profileList = document.getElementById("profile-list");
  const addBtn = document.getElementById("add-profile-btn");
  const avatarChoicesDiv = document.getElementById("avatar-choices");

  // Example avatar options (emojis or initials)
  const avatarOptions = ["😀", "👩‍💻", "🧑‍🎤", "🦸", "🦸‍♀️", "👨‍🎨", "👩‍🚀", "🧒", "👶", "🐱", "🐶", "🍕", "🎬", "K", "M", "D"];

  let selectedAvatar = avatarOptions[0];

  function renderAvatarChoices() {
    avatarChoicesDiv.innerHTML = "";
    avatarOptions.forEach(avatar => {
      const div = document.createElement("div");
      div.className = "avatar-choice" + (avatar === selectedAvatar ? " selected" : "");
      div.textContent = avatar;
      div.onclick = () => {
        selectedAvatar = avatar;
        renderAvatarChoices();
      };
      avatarChoicesDiv.appendChild(div);
    });
  }

  function renderProfiles() {
    profileList.innerHTML = "";
    profiles.forEach((profile, idx) => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.cursor = "pointer";

      const div = document.createElement("div");
      div.className = "profile-avatar";
      div.textContent = profile.avatar || profile.name[0].toUpperCase();
      div.title = profile.name;
      div.onclick = () => selectProfile(idx);

      const nameLabel = document.createElement("div");
      nameLabel.className = "profile-name-label";
      nameLabel.textContent = profile.name;

      wrapper.appendChild(div);
      wrapper.appendChild(nameLabel);
      profileList.appendChild(wrapper);
    });
  }

  function selectProfile(idx) {
    localStorage.setItem("currentProfile", JSON.stringify(profiles[idx]));
    window.location.href = "index.html";
  }

  addBtn.onclick = () => {
    const name = prompt("Enter profile name:");
    if (name) {
      profiles.push({ name, avatar: selectedAvatar });
      localStorage.setItem("cineprime-profiles", JSON.stringify(profiles));
      renderProfiles();
    }
  };

  renderAvatarChoices();
  renderProfiles();
});