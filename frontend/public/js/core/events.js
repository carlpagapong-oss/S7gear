// ---------- Event registry ----------
// Each page registers its own handlers here:
//   CLICK.<name>   runs when an element with  data-<name>="..."  is clicked
//   ACTION.<name>  runs when an element with  data-action="<name>"  is clicked
//   FORMS.<id>     runs when the <form id="<id>"> is submitted

export const CLICK = {};
export const ACTION = {};
export const FORMS = {};

CLICK.action = (el) => ACTION[el.dataset.action]?.();

export function initEvents() {
  document.addEventListener("click", (event) => {
    const names = Object.keys(CLICK);
    const el = event.target.closest(names.map((name) => `[data-${name}]`).join(","));
    if (!el) return;

    const name = names.find((n) => n in el.dataset);
    CLICK[name](el, event);
  });

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    FORMS[form.id]?.(form, Object.fromEntries(new FormData(form)));
  });
}
