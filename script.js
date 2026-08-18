// ---- View switching (Personal Projects / DSS / DCRT) ----
// Sections stay hidden until a button is clicked; only one shows at a time.
(function () {
  const switchers = document.querySelectorAll("button[data-view]");
  const views = document.querySelectorAll(".view");

  function showView(name) {
    let target = null;
    views.forEach(function (view) {
      const isMatch = view.id === "view-" + name;
      view.classList.toggle("active", isMatch);
      if (isMatch) target = view;
    });
    document.querySelectorAll(".view-btn").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.view === name));
    });
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  switchers.forEach(function (btn) {
    btn.addEventListener("click", function () { showView(btn.dataset.view); });
  });
})();

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
