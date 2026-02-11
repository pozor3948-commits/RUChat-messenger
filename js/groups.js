/* ==========================================================
   11. ГРУППЫ
   ========================================================== */
function showCreateGroupModal() {
  document.getElementById("groupModalOverlay").style.display = "flex";
  loadFriendsForGroup();
}

function closeGroupModal() {
  document.getElementById("groupModalOverlay").style.display = "none";
}

function loadFriendsForGroup() {
  const ml = document.getElementById("groupMembersList");
  ml.innerHTML = "";
  db.ref("accounts/" + username + "/friends").once("value").then(s => {
    if (!s.exists()) { ml.innerHTML = '<div style="color:#8a8f98;padding:20px;text-align:center;">Нет друзей для добавления</div>'; return; }
    s.forEach(ch => {
      const fn = ch.key;
      const d = document.createElement("div");
      d.className = "group-member-item";
      const displayName = typeof normalizeText === 'function' ? normalizeText(fn) : fn;
      d.innerHTML = `<input type="checkbox" class="group-member-checkbox" id="member_${fn}" value="${fn}"><label for="member_${fn}" style="flex:1;cursor:pointer;">${displayName}</label>`;
      ml.appendChild(d);
    });
  });
}

async function createGroup() {
  const n = document.getElementById("groupNameInput").value.trim();
  const av = document.getElementById("groupAvatarInput").value.trim();
  const avatarUrl = av && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(av)) ? av : "";
  if (!n) { showError("Введите название группы!"); return; }
  const ch = document.querySelectorAll(".group-member-checkbox:checked");
  if (!ch.length) { showError("Выберите хотя бы одного участника!"); return; }
  const members = {};
  ch.forEach(c => members[c.value] = true);
  members[username] = true;
  try {
    const ref = db.ref("groups").push();
    await ref.set({ name: n, avatar: avatarUrl, members: members, createdBy: username, createdAt: Date.now() });
    showNotification("Успешно", `Группа "${n}" создана!`);
    closeGroupModal();
    document.getElementById("groupNameInput").value = "";
    document.getElementById("groupAvatarInput").value = "";
  } catch (e) { showError("Ошибка создания группы"); }
}

