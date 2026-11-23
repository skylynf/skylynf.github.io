(function () {
  "use strict";

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduceMotion = false;
  }

  function reveal() {
    var nodes = document.querySelectorAll(".isthmus-reveal");
    if (!nodes.length) return;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      nodes.forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  function bibCopy() {
    var btn = document.getElementById("actus-copy-bib");
    var block = document.getElementById("actus-bibtex-text");
    if (!btn || !block) return;
    btn.addEventListener("click", function () {
      var text = block.innerText || block.textContent;
      var done = function () {
        var prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () {
          btn.textContent = prev;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          window.prompt("Copy BibTeX", text);
        });
      } else {
        window.prompt("Copy BibTeX", text);
      }
    });
  }

  function init() {
    reveal();
    bibCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
