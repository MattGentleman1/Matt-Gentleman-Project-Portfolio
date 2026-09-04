// ---- Tone toggle (Formal / Casual) ----
// The chosen tone is stored in localStorage so it persists between visits.
(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll("[data-set-tone]");

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

  var saved = null;
  try { saved = localStorage.getItem("portfolio-tone"); } catch (e) { /* ignore */ }
  if (saved === "formal" || saved === "informal") setTone(saved);
})();

// ---- Scroll reveal ----
(function () {
  var items = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("visible"); });
    return;
  }
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  items.forEach(function (el) { observer.observe(el); });
})();

// ---- Nav: mark the section currently in view ----
(function () {
  var links = document.querySelectorAll('a[href^="#"]');
  var targets = [];
  links.forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    var el = id && document.getElementById(id);
    if (el && !targets.some(function (t) { return t.el === el; })) targets.push({ el: el, id: id });
  });
  if (!targets.length || !("IntersectionObserver" in window)) return;

  var current = null;
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) current = entry.target.id;
      });
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + current;
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  targets.forEach(function (t) { observer.observe(t.el); });
})();
