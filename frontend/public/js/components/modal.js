import { $, } from "../core/helpers.js";
import { CLICK } from "../core/events.js";

export function openModal(html) {
  $("#modalCard").innerHTML = html;
  $("#modal").classList.remove("hidden");
}

export function closeModal() {
  $("#modal").classList.add("hidden");
}

// Any element with data-close (Cancel / Close buttons) closes the modal.
CLICK.close = closeModal;

// Clicking the dark backdrop closes it too.
$("#modal").addEventListener("click", (event) => {
  if (event.target.id === "modal") closeModal();
});
