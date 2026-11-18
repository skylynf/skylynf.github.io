// Accent palette toggle (Blue / Teal). The matching data-accent attribute is
// also set by a tiny inline script in <head> to avoid a flash of the wrong color.

const determineAccent = () => (localStorage.getItem("accent") === "teal" ? "teal" : "blue");

const setAccent = (accent) => {
  const value = accent === "teal" ? "teal" : "blue";
  localStorage.setItem("accent", value);
  document.documentElement.setAttribute("data-accent", value);

  const btn = document.getElementById("accent-toggle");
  if (btn) {
    const current = value === "teal" ? "Teal" : "Blue";
    const label = "Switch accent color (currently " + current + ")";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }
};

const toggleAccent = () => {
  setAccent(determineAccent() === "blue" ? "teal" : "blue");
};

const initAccent = () => {
  setAccent(determineAccent());

  document.addEventListener("DOMContentLoaded", function () {
    setAccent(determineAccent());
    const btn = document.getElementById("accent-toggle");
    if (btn) {
      btn.addEventListener("click", toggleAccent);
    }
  });
};

initAccent();
