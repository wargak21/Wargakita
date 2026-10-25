(function () {
  "use strict";

  function initWargaKitaMobileMenu() {
    if (document.querySelector(".wk-mobile-menu-button")) return;

    var sidebar = document.querySelector(
      ".wk-sidebar, .sidebar, .app-sidebar, .main-sidebar, aside.sidebar, aside.app-sidebar, .dashboard-sidebar"
    );

    if (!sidebar) return;

    var body = document.body;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "wk-mobile-menu-button";
    button.setAttribute("aria-label", "Buka menu navigasi");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = "☰";

    var topbar = document.createElement("div");
    topbar.className = "wk-mobile-topbar";

    var title = document.createElement("div");
    title.className = "wk-mobile-topbar-title";
    title.textContent = "WargaKita";

    topbar.appendChild(button);
    topbar.appendChild(title);

    var overlay = document.createElement("div");
    overlay.className = "wk-sidebar-overlay";
    overlay.setAttribute("aria-hidden", "true");

    function openMenu() {
      body.classList.add("wk-sidebar-open");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Tutup menu navigasi");
      button.innerHTML = "✕";
    }

    function closeMenu() {
      body.classList.remove("wk-sidebar-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Buka menu navigasi");
      button.innerHTML = "☰";
    }

    button.addEventListener("click", function () {
      if (body.classList.contains("wk-sidebar-open")) closeMenu();
      else openMenu();
    });

    overlay.addEventListener("click", closeMenu);

    sidebar.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 768px)").matches) closeMenu();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) closeMenu();
    });

    body.insertBefore(overlay, body.firstChild);
    body.insertBefore(topbar, body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWargaKitaMobileMenu);
  } else {
    initWargaKitaMobileMenu();
  }
})();
