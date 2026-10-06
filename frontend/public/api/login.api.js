async function login(username, password) {
  try {
    const res = await fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      sessionStorage.setItem("user_id", data.user_id);
      window.location.href = "dashboard.html";
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Cannot reach the server. Is Flask running?");
  }
}