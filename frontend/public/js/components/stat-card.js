/** Small number card used on Home and Availability. `color` is any CSS color. */
export const statCard = (value, label, color) => `
  <div class="stat" style="--c:${color}">
    <b>${value}</b><span>${label}</span>
  </div>`;
