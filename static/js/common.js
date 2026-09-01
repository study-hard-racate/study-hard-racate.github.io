/* 公共功能：导航高亮、主题切换、快捷键浮层、下拉菜单键盘操作、ARIA 增强 */
(function () {
  "use strict";

  /* ===== 导航当前页高亮 ===== */
  (function () {
    if (typeof location === "undefined") return;
    var path = location.pathname;
    var map = [
      ["/sorting", "排序算法"],
      ["/data-structure", "数据结构"],
      ["/array", "数据结构"],
      ["/linked-list", "数据结构"],
      ["/stack", "数据结构"],
      ["/queue", "数据结构"],
      ["/tree/union-find", "数据结构"],
      ["/search", "查找算法"],
      ["/tree-graph", "树与图"],
      ["/tree", "树与图"],
      ["/graph", "树与图"],
      ["/dp", "动态规划"],
      ["/learning-path", "学习路径"],
    ];
    for (var i = 0; i < map.length; i++) {
      if (path.indexOf(map[i][0]) === 0) {
        var items = document.querySelectorAll(".nav-item > a");
        for (var j = 0; j < items.length; j++) {
          if (items[j].textContent.indexOf(map[i][1]) >= 0) items[j].classList.add("active");
        }
        break;
      }
    }
  })();

  /* ===== 主题切换 ===== */
  (function () {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    try {
      var saved = localStorage.getItem("theme");
      if (saved === "light") {
        document.body.classList.add("light");
        toggle.textContent = "🌙";
      }
    } catch (e) {}
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("light");
      var isLight = document.body.classList.contains("light");
      toggle.textContent = isLight ? "🌙" : "☀️";
      try { localStorage.setItem("theme", isLight ? "light" : "dark"); } catch (e) {}
    });
  })();

  /* ===== 快捷键提示浮层 ===== */
  (function () {
    var overlay = document.getElementById("shortcuts-overlay");
    var closeBtn = document.getElementById("shortcuts-close");
    if (!overlay) return;

    function showShortcuts() {
      overlay.classList.add("visible");
      if (closeBtn) closeBtn.focus();
    }
    function hideShortcuts() {
      overlay.classList.remove("visible");
    }

    if (closeBtn) closeBtn.addEventListener("click", hideShortcuts);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) hideShortcuts(); });

    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?") { e.preventDefault(); overlay.classList.contains("visible") ? hideShortcuts() : showShortcuts(); }
      if (e.key === "Escape" && overlay.classList.contains("visible")) { e.preventDefault(); hideShortcuts(); }
      if (e.key === "t" || e.key === "T") {
        if (e.target && e.target.tagName === "SELECT") return;
        document.body.classList.toggle("light");
        var isLight = document.body.classList.contains("light");
        var toggle = document.getElementById("theme-toggle");
        if (toggle) toggle.textContent = isLight ? "🌙" : "☀️";
        try { localStorage.setItem("theme", isLight ? "light" : "dark"); } catch (e) {}
      }
    });
  })();

  /* ===== 下拉菜单键盘可访问 ===== */
  (function () {
    var navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(function (item) {
      var link = item.querySelector(":scope > a");
      var dropdown = item.querySelector(".dropdown");
      if (!link || !dropdown) return;

      /* ARIA 属性 */
      link.setAttribute("aria-haspopup", "true");
      link.setAttribute("aria-expanded", "false");

      function openDropdown() {
        dropdown.style.display = "block";
        link.setAttribute("aria-expanded", "true");
      }
      function closeDropdown() {
        dropdown.style.display = "";
        link.setAttribute("aria-expanded", "false");
      }

      /* 键盘操作 */
      link.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          var isOpen = dropdown.style.display === "block";
          if (isOpen) { closeDropdown(); } else { openDropdown(); }
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          openDropdown();
          var firstLink = dropdown.querySelector("a");
          if (firstLink) firstLink.focus();
        }
        if (e.key === "Escape") {
          closeDropdown();
          link.focus();
        }
      });

      dropdown.addEventListener("keydown", function (e) {
        var links = dropdown.querySelectorAll("a");
        var current = document.activeElement;
        var idx = Array.prototype.indexOf.call(links, current);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (idx < links.length - 1) links[idx + 1].focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (idx > 0) { links[idx - 1].focus(); } else { closeDropdown(); link.focus(); }
        }
        if (e.key === "Escape") {
          closeDropdown();
          link.focus();
        }
        if (e.key === "Tab") {
          closeDropdown();
        }
      });

      /* 失焦关闭 */
      item.addEventListener("focusout", function (e) {
        setTimeout(function () {
          if (!item.contains(document.activeElement)) closeDropdown();
        }, 100);
      });
    });
  })();

  /* ===== ARIA 增强 ===== */
  (function () {
    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn && !themeBtn.getAttribute("aria-label")) {
      themeBtn.setAttribute("aria-label", "切换深色/浅色主题");
    }
    var collapseBtn = document.querySelector(".code-collapse-btn");
    if (collapseBtn && !collapseBtn.getAttribute("aria-label")) {
      collapseBtn.setAttribute("aria-label", "折叠/展开代码面板");
    }
    var shortcutsOverlay = document.getElementById("shortcuts-overlay");
    if (shortcutsOverlay) {
      shortcutsOverlay.setAttribute("role", "dialog");
      shortcutsOverlay.setAttribute("aria-modal", "true");
      shortcutsOverlay.setAttribute("aria-label", "键盘快捷键帮助");
    }
    var shortcutsClose = document.getElementById("shortcuts-close");
    if (shortcutsClose && !shortcutsClose.getAttribute("aria-label")) {
      shortcutsClose.setAttribute("aria-label", "关闭快捷键帮助");
    }
  })();

  /* ===== PWA：Service Worker 注册（离线缓存） ===== */
  (function () {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      });
    }
  })();

})();
