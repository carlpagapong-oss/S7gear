const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

const showIcon = document.getElementById("showIcon");
const hideIcon = document.getElementById("hideIcon");

hideIcon.style.display = "none";

togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {
        passwordInput.type = "text";

        showIcon.style.display = "none";
        hideIcon.style.display = "block";
    } else {
        passwordInput.type = "password";

        showIcon.style.display = "block";
        hideIcon.style.display = "none";
    }

});

const loginForm = document.querySelector("form");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    await login(username, password);
});