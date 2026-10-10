// Toast — small message at the bottom right.
import { $ } from "../helpers.js";

let toastTimer;

export function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 2500);
}
