/* ============================================================
   洁家无忧 · 家政服务官网交互脚本
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 1. 顶部导航：滚动后加阴影 ---------- */
  var header = document.getElementById("siteHeader");
  var backToTop = document.getElementById("backToTop");

  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 20);
    if (backToTop) backToTop.classList.toggle("show", y > 600);
    updateActiveNav(y);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- 2. 移动端菜单 ---------- */
  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("mainNav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      navToggle.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    });

    // 点击链接后关闭移动端菜单
    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        navToggle.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- 3. 当前区块高亮 ---------- */
  var navLinks = Array.prototype.slice.call(
    (document.querySelectorAll(".main-nav ul a")) || []
  );

  function updateActiveNav(y) {
    if (!navLinks.length) return;
    var currentId = null;
    document.querySelectorAll("section[id], footer[id]").forEach(function (sec) {
      if (y >= sec.offsetTop - 140) currentId = sec.id;
    });
    navLinks.forEach(function (link) {
      var target = (link.getAttribute("href") || "").replace("#", "");
      link.classList.toggle("active", target === currentId);
    });
  }

  /* ---------- 4. 回到顶部 ---------- */
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- 5. 滚动显现动画 ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- 6. 数字滚动统计 ---------- */
  var counters = document.querySelectorAll("[data-count]");
  var counted = new WeakSet();

  function animateCount(el) {
    if (counted.has(el)) return;
    counted.add(el);
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var duration = 1600;
    var start = performance.now();

    function tick(now) {
      var p = Math.min((now - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = val >= 10000 ? (val / 10000).toFixed(1).replace(/\.0$/, "") + "万+" : val.toLocaleString("zh-CN");
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = "8万+"; });
  }

  /* ---------- 7. 预约表单校验 + 弹窗 ---------- */
  var form = document.getElementById("bookForm");
  var modal = document.getElementById("successModal");

  function validateField(field) {
    var ok = true;
    if (!field.value.trim()) {
      ok = false;
    } else if (field.type === "tel" && !/^1[3-9]\d{9}$/.test(field.value.trim())) {
      ok = false;
    }
    field.classList.toggle("invalid", !ok);
    return ok;
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fields = ["fName", "fPhone", "fCity", "fService"];
      var allOk = true;
      var firstInvalid = null;
      fields.forEach(function (id) {
        var f = document.getElementById(id);
        if (!f) return;
        var ok = validateField(f);
        if (!ok) {
          allOk = false;
          if (!firstInvalid) firstInvalid = f;
        }
      });
      if (!allOk) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      // 提交预约到接收服务（server.js）；未启动服务时降级为本机保存
      var payload = {
        name: document.getElementById("fName").value.trim(),
        phone: document.getElementById("fPhone").value.trim(),
        city: document.getElementById("fCity").value.trim(),
        service: document.getElementById("fService").value,
        note: document.getElementById("fNote").value.trim()
      };
      var submitBtn = form.querySelector("button[type=submit]");
      var modalBody = document.getElementById("modalBody");
      var modalHint = document.getElementById("modalHint");

      function finishSubmit(serverOk) {
        openModal();
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "提交预约 <span aria-hidden=\"true\">→</span>";
        }
        if (modalHint) {
          modalHint.hidden = serverOk !== false;
          modalHint.textContent = "提示：当前未启动接收服务，本条信息仅保存在本机浏览器。请通过「启动网站.bat」运行后提交，或拨打 15057012002 联系。";
        }
      }

      function localSave(item) {
        try {
          var key = "jzlm_pending_bookings";
          var list = [];
          try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
          list.unshift(Object.assign({ savedAt: new Date().toLocaleString("zh-CN", { hour12: false }) }, item));
          localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
        } catch (e) {}
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "提交中…";
      }

      fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            return { ok: r.ok, d: d };
          });
        })
        .then(function (res) {
          if (res.ok && res.d && res.d.ok) {
            finishSubmit(true);
          } else {
            localSave(payload);
            finishSubmit(false);
          }
        })
        .catch(function () {
          localSave(payload);
          finishSubmit(false);
        });
    });

    // 输入时清除错误状态
    form.querySelectorAll("input, select").forEach(function (f) {
      f.addEventListener("input", function () {
        f.classList.remove("invalid");
      });
      f.addEventListener("change", function () {
        f.classList.remove("invalid");
      });
    });
  }

  if (modal) {
    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  /* ---------- 8. 页脚年份 ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 初始化 ---------- */
  onScroll();
})();
