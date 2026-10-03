// Safisha Industries website — small shared behaviours, no dependencies.
document.addEventListener("DOMContentLoaded", function () {
  // Mobile nav toggle
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector("nav.mainnav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      var expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }

  // Enquiry form (contact.html) — posts to the send-enquiry Netlify Function
  // (netlify/functions/send-enquiry.js), falls back to a mailto link if the
  // request fails (e.g. the function's email provider isn't configured yet).
  var form = document.querySelector("form.enquiry");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (status) {
        status.className = "form-status show";
        status.textContent = "Sending…";
      }
      var fd = new FormData(form);
      var data = {
        name: fd.get("name") || "",
        phone: fd.get("phone") || "",
        email: fd.get("email") || "",
        interest: fd.get("interest") || "",
        message: fd.get("message") || "",
      };
      fetch("/.netlify/functions/send-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (res) { return res.json().catch(function () { return { ok: res.ok }; }); })
        .then(function (result) {
          if (result && result.ok) {
            form.reset();
            status.className = "form-status show ok";
            status.textContent = "Thanks — we've received your message and will get back to you shortly.";
          } else {
            throw new Error((result && result.error) || "send_failed");
          }
        })
        .catch(function () {
          status.className = "form-status show err";
          status.innerHTML =
            'Something went wrong sending this automatically. Please email us directly at ' +
            '<a href="mailto:sales@safisha.co.zw">sales@safisha.co.zw</a> or WhatsApp +263 772 164 975.';
        });
    });
  }

  // Product search (products.html) — filters product cards client-side by
  // name/description/spec text, hides whole category blocks with no matches,
  // and points the visitor to the enquiry form when nothing matches at all.
  var searchInput = document.getElementById("productSearch");
  if (searchInput) {
    var catBlocks = document.querySelectorAll("[data-cat-block]");
    var emptyMsg = document.getElementById("searchEmpty");

    var runSearch = function () {
      var q = searchInput.value.trim().toLowerCase();
      var totalVisible = 0;

      catBlocks.forEach(function (block) {
        var cards = block.querySelectorAll(".product-card");
        var visibleInBlock = 0;
        cards.forEach(function (card) {
          var hay = card.getAttribute("data-search") || "";
          var match = q === "" || hay.indexOf(q) !== -1;
          card.hidden = !match;
          if (match) visibleInBlock++;
        });
        block.hidden = visibleInBlock === 0;
        totalVisible += visibleInBlock;

        var countEl = block.querySelector(".cat-banner .count");
        if (countEl) {
          countEl.textContent = visibleInBlock + (visibleInBlock === 1 ? " product" : " products");
        }
      });

      if (emptyMsg) emptyMsg.hidden = !(q !== "" && totalVisible === 0);
    };

    searchInput.addEventListener("input", runSearch);
  }

  // Waving logo (index.php hero) — the SVG ripple filter's frequency/
  // displacement were hand-tuned for a 150px logo. The logo itself is now
  // fluid-sized (CSS clamp), so re-scale those filter values to match its
  // actual rendered size whenever it changes, keeping the wave looking the
  // same proportionally whether the logo is small on a phone or full-size
  // on desktop, instead of looking too jittery or too flat.
  var waveLogo = document.querySelector(".hero-logo-wave");
  var waveTurb = document.getElementById("wave-turb");
  var waveTurbAnim = document.getElementById("wave-turb-anim");
  var waveDisp = document.getElementById("wave-disp");
  if (waveLogo && waveTurb && waveTurbAnim && waveDisp) {
    // Reference values below were tuned at this logo width (px).
    var BASE_W = 150;
    var FREQ_X_LO = 0.005 * BASE_W; // cycles across the whole width
    var FREQ_X_HI = 0.008 * BASE_W;
    var FREQ_Y = 0.09 * BASE_W;
    var DISPLACEMENT_RATIO = 18 / BASE_W; // px of displacement per px of logo width

    var applyTuning = function (w) {
      if (!w) return;
      var fxLo = FREQ_X_LO / w;
      var fxHi = FREQ_X_HI / w;
      var fy = FREQ_Y / w;
      var scale = DISPLACEMENT_RATIO * w;
      waveTurb.setAttribute("baseFrequency", fxLo + " " + fy);
      waveTurbAnim.setAttribute(
        "values",
        fxLo + " " + fy + ";" + fxHi + " " + fy + ";" + fxLo + " " + fy
      );
      waveDisp.setAttribute("scale", scale);
      // Restart the SMIL animation so it picks up the new values cleanly.
      if (typeof waveTurbAnim.beginElement === "function") {
        try {
          waveTurbAnim.beginElement();
        } catch (e) {
          /* SMIL restart isn't supported everywhere — safe to ignore. */
        }
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          applyTuning(entries[i].contentRect.width);
        }
      });
      ro.observe(waveLogo);
    } else {
      // Fallback for older browsers without ResizeObserver.
      applyTuning(waveLogo.getBoundingClientRect().width);
      window.addEventListener("resize", function () {
        applyTuning(waveLogo.getBoundingClientRect().width);
      });
    }
  }
});
