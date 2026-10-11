async function login(username, password) {
  try {
    const response = await fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      sessionStorage.setItem("user_id", data.user_id);
      sessionStorage.setItem("employee_id", data.employee_id);
      sessionStorage.setItem("employee_name", data.employee_name);
      window.location.href = "index.html";
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Cannot reach the server. Is Flask running?");
  }
}