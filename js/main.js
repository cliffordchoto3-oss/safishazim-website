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

  // Product photo framing (products.html) — the catalogue's photos aren't
  // all one shape: bottles/canisters are portrait, but broom/mop handles
  // and roll dispensers are much narrower, and mats/scrapers/rails are
  // landscape. Forcing every photo into the same fixed box left the narrow
  // and wide ones shrunk down with huge empty margins. Instead, measure
  // each photo's own width/height once it's loaded and let its frame
  // (.product-img-wrap, via the --img-ar custom property in styles.css)
  // hug that shape — clamped to a sane range so grid rows never get
  // stretched to extremes by one unusually narrow or wide photo.
  var productPhotos = document.querySelectorAll(".product-img-wrap img");
  if (productPhotos.length) {
    var MIN_PHOTO_RATIO = 0.55;
    var MAX_PHOTO_RATIO = 1.3;
    var applyPhotoRatio = function (img) {
      if (!img.naturalWidth || !img.naturalHeight) return;
      var ratio = img.naturalWidth / img.naturalHeight;
      ratio = Math.max(MIN_PHOTO_RATIO, Math.min(MAX_PHOTO_RATIO, ratio));
      if (img.parentElement) {
        img.parentElement.style.setProperty("--img-ar", ratio);
      }
    };
    productPhotos.forEach(function (img) {
      if (img.complete) {
        applyPhotoRatio(img);
      } else {
        img.addEventListener("load", function () { applyPhotoRatio(img); });
      }
    });
  }

  // Waving logo (index.php hero) — the SVG ripple filter's frequency/
  // displacement were hand-tuned for a 150px logo. The logo itself is now
  // fluid-sized (CSS clamp), so re-scale those filter values to match its
  // actual rendered size whenever it changes, keeping the wave looking the
  // same proportionally whether the logo is small on a phone or full-size
  // on desktop, instead of looking too jittery or too flat.
  var waveLogo = document.querySelector(".hero-logo-wave");
  var waveTurb = document.getElementById("wave-turb");
  var waveOffsetAnim = document.getElementById("wave-offset-anim");
  var waveDisp = document.getElementById("wave-disp");
  if (waveLogo && waveTurb && waveOffsetAnim && waveDisp) {
    // Reference values below were tuned at this logo width (px). The noise
    // field itself (baseFrequency) is static — only the feOffset's dx is
    // animated (in index.html), sliding that fixed pattern sideways for a
    // real traveling ripple instead of a shimmering re-randomized texture.
    var BASE_W = 150;
    var FREQ_X = 0.006 * BASE_W; // cycles across the whole width — low = large, even bands
    var FREQ_Y = 0.045 * BASE_W;
    var OFFSET_AMPLITUDE_RATIO = 32 / BASE_W; // px the pattern slides, per px of logo width
    var DISPLACEMENT_RATIO = 16 / BASE_W; // px of displacement per px of logo width

    var applyTuning = function (w) {
      if (!w) return;
      var fx = FREQ_X / w;
      var fy = FREQ_Y / w;
      var amp = Math.round(OFFSET_AMPLITUDE_RATIO * w);
      var scale = DISPLACEMENT_RATIO * w;
      waveTurb.setAttribute("baseFrequency", fx + " " + fy);
      waveOffsetAnim.setAttribute("values", -amp + ";" + amp + ";" + -amp);
      waveDisp.setAttribute("scale", scale);
      // Restart the SMIL animation so it picks up the new values cleanly.
      if (typeof waveOffsetAnim.beginElement === "function") {
        try {
          waveOffsetAnim.beginElement();
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
