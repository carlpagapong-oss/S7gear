const API_BASE_URL = "http://127.0.0.1:5000/api";

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem("auth_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const responseText = await response.text();

  let data = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.clear();
      window.location.replace(new URL("login.html", window.location.href).href);
    }
    throw new Error(data?.message || `Request failed (${response.status}).`);
  }

  return data;
}

export function logout() {
  return apiRequest("/session", { method: "DELETE" });
}

export function postJson(path, value) {
  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(value),
  });
}
