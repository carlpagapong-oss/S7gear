const userId = sessionStorage.getItem("user_id");

if (!userId) {
  window.location.href = "login.html";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "login.html";
});