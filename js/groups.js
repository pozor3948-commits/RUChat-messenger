/* ==========================================================
   11. Р“Р РЈРџРџР«
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
    if (!s.exists()) { ml.innerHTML = '<div style="color:#8a8f98;padding:20px;text-align:center;">РќРµС‚ РґСЂСѓР·РµР№ РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ</div>'; return; }
    s.forEach(ch => {
      const fn = ch.key;
      const d = document.createElement("div");
      d.className = "group-member-item";
      d.innerHTML = `<input type="checkbox" class="group-member-checkbox" id="member_${fn}" value="${fn}"><label for="member_${fn}" style="flex:1;cursor:pointer;">${fn}</label>`;
      ml.appendChild(d);
    });
  });
}

async function createGroup() {
  const n = document.getElementById("groupNameInput").value.trim();
  const av = document.getElementById("groupAvatarInput").value.trim();
  if (!n) { showError("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РіСЂСѓРїРїС‹!"); return; }
  const ch = document.querySelectorAll(".group-member-checkbox:checked");
  if (!ch.length) { showError("Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР°!"); return; }
  const members = {};
  ch.forEach(c => members[c.value] = true);
  members[username] = true;
  try {
    const ref = db.ref("groups").push();
    await ref.set({ name: n, avatar: av, members: members, createdBy: username, createdAt: Date.now() });
    showNotification("РЈСЃРїРµС€РЅРѕ", `Р“СЂСѓРїРїР° "${n}" СЃРѕР·РґР°РЅР°!`);
    closeGroupModal();
    document.getElementById("groupNameInput").value = "";
    document.getElementById("groupAvatarInput").value = "";
  } catch (e) { showError("РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РіСЂСѓРїРїС‹"); }
}
