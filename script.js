// ---- Tone toggle (Formal / Casual) ----
// The chosen tone is stored in localStorage so it persists between visits.
(function () {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-set-tone]");

  function setTone(tone) {
    root.setAttribute("data-tone", tone);
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.setTone === tone));
    });
    try { localStorage.setItem("portfolio-tone", tone); } catch (e) { /* private browsing */ }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { setTone(btn.dataset.setTone); });
  });

  let saved = null;
  try { saved = localStorage.getItem("portfolio-tone"); } catch (e) { /* ignore */ }
  if (saved === "formal" || saved === "informal") setTone(saved);
})();

// ---- Scroll reveal ----
(function () {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("visible"); });
    return;
  }
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach(function (el) { observer.observe(el); });
})();
