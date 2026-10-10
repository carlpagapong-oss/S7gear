// Modal — pop-up window. A modal is a <div class="modal hidden" id="..."> in the page's HTML.

export function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

export function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close a modal when its dark background or any [data-close-modal] button is clicked.
export function initModals() {
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      event.target.classList.add("hidden");
    }

    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) {
      closeButton.closest(".modal").classList.add("hidden");
    }
  });
}
