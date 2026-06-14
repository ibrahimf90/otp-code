/* ─── Config ───────────────────────────────────────────────── */
const correctCode = "1234";
const MAX_ATTEMPTS = 3;
const RESEND_SECS = 30;
const LOCK_SECS = 60;
const MASKED_PHONE = "01•• ••••••20";

/* ─── i18n ─────────────────────────────────────────────────── */
const translations = {
  en: {
    title: "Let's verify your number",
    subtitle: `We sent a 4-digit code to <strong>${MASKED_PHONE}</strong>.<br>Enter it below and tap Verify.`,
    submit: "Verify Code",
    resend: "Resend code",
    resendIn: "Resend in",
    wrongTitle: "Incorrect code",
    wrongSubtitle: "The code you entered is incorrect.<br>Please try again.",
    successTitle: "Verified!",
    successSubtitle: `Your number <strong>${MASKED_PHONE}</strong> has been confirmed.`,
    reset: "Back to start",
    lockedTitle: "Too many attempts",
    lockedSubtitle: "Account temporarily locked. Try again in:",
    attemptsLeft: (n) => `${n} attempt${n === 1 ? "" : "s"} remaining`,
    dir: "ltr",
  },
  de: {
    title: "Lass uns deine Nummer überprüfen",
    subtitle: `Wir haben einen 4-stelligen Code an <strong>${MASKED_PHONE}</strong> gesendet.<br>Gib ihn unten ein und tippe auf Bestätigen.`,
    submit: "Code bestätigen",
    resend: "Code erneut senden",
    resendIn: "Erneut senden in",
    wrongTitle: "Falscher Code",
    wrongSubtitle:
      "Der eingegebene Code ist falsch.<br>Bitte versuche es erneut.",
    successTitle: "Verifiziert!",
    successSubtitle: `Deine Nummer <strong>${MASKED_PHONE}</strong> wurde bestätigt.`,
    reset: "Zurück zum Start",
    lockedTitle: "Zu viele Versuche",
    lockedSubtitle: "Konto vorübergehend gesperrt. Versuche es in:",
    attemptsLeft: (n) => `Noch ${n} Versuch${n === 1 ? "" : "e"}`,
    dir: "ltr",
  },
  ar: {
    title: "دعنا نتحقق من رقمك",
    subtitle: `لقد أرسلنا رمزًا مكونًا من 4 أرقام إلى <strong>${MASKED_PHONE}</strong>.<br>أدخله أدناه واضغط على تحقق.`,
    submit: "تحقق من الرمز",
    resend: "إعادة إرسال الرمز",
    resendIn: "إعادة الإرسال خلال",
    wrongTitle: "الرمز غير صحيح",
    wrongSubtitle: "الرمز الذي أدخلته غير صحيح.<br>يرجى المحاولة مرة أخرى.",
    successTitle: "تم التحقق!",
    successSubtitle: `لقد تم تأكيد رقمك <strong>${MASKED_PHONE}</strong> بنجاح.`,
    reset: "الصفحة الرئيسية",
    lockedTitle: "محاولات كثيرة جدًا",
    lockedSubtitle: "الحساب مقفل مؤقتًا. حاول مرة أخرى خلال:",
    attemptsLeft: (n) => `${n} محاولة متبقية`,
    dir: "rtl",
  },
};

/* ─── State ────────────────────────────────────────────────── */
let lang = "en";
let t = translations[lang];
let attempts = 0;
let resendTimer = null;
let lockTimer = null;
let resendCountdown = null;
let isLocked = false;

/* ─── DOM refs ─────────────────────────────────────────────── */
const html = document.documentElement;
const card = document.getElementById("card");
const langButtons = document.querySelectorAll("[data-lang-btn]");

/* ─── Language ─────────────────────────────────────────────── */
function applyLanguage(newLang) {
  lang = newLang;
  t = translations[lang];
  html.setAttribute("lang", lang);
  html.setAttribute("dir", t.dir);
  html.setAttribute("data-lang", lang);

  langButtons.forEach((btn) =>
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang),
  );

  if (!isLocked) resetForm();
}

langButtons.forEach((btn) =>
  btn.addEventListener("click", () =>
    applyLanguage(btn.getAttribute("data-lang-btn")),
  ),
);

/* ─── Render OTP form ──────────────────────────────────────── */
function resetForm() {
  clearCountdownTimer();
  attempts = 0;

  card.className = "card";
  card.innerHTML = `
    <h1 id="title"></h1>
    <p  id="subtitle"></p>
    <div class="boxes" id="boxes">
      <input maxlength="1" inputmode="numeric" id="otp-0" autocomplete="one-time-code">
      <input maxlength="1" inputmode="numeric" id="otp-1">
      <input maxlength="1" inputmode="numeric" id="otp-2">
      <input maxlength="1" inputmode="numeric" id="otp-3">
    </div>
    <button class="submit-btn" id="submitBtn"></button>
    <button class="resend"     id="resendBtn"></button>
  `;

  initOtpView();
}

/* ─── Wire up OTP inputs ───────────────────────────────────── */
function initOtpView() {
  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const resendEl = document.getElementById("resendBtn");
  const submitEl = document.getElementById("submitBtn");
  const boxesEl = document.getElementById("boxes");
  const inputEls = Array.from(boxesEl.querySelectorAll("input"));

  titleEl.textContent = t.title;
  subtitleEl.innerHTML = t.subtitle;
  submitEl.textContent = t.submit;

  startResendCooldown(resendEl);

  /* ── Navigation ── */
  inputEls.forEach((input, i) => {
    input.addEventListener("input", () => {
      // only allow digits
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && i < inputEls.length - 1) inputEls[i + 1].focus();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0)
        inputEls[i - 1].focus();
      if (e.key === "Enter") submitEl.click();
    });

    /* ── Paste support ── */
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 4);
      if (!pasted) return;
      [...pasted].forEach((ch, idx) => {
        if (inputEls[idx]) inputEls[idx].value = ch;
      });
      const nextEmpty = inputEls.find((el) => !el.value);
      (nextEmpty || inputEls[inputEls.length - 1]).focus();
      // auto-submit if all 4 filled
      if (pasted.length === 4) setTimeout(() => submitEl.click(), 100);
    });
  });

  /* ── Submit ── */
  submitEl.addEventListener("click", () => {
    const code = inputEls.map((x) => x.value).join("");
    if (code.length < 4) {
      const firstEmpty = inputEls.find((el) => !el.value);
      if (firstEmpty) firstEmpty.focus();
      return;
    }
    verify(code, inputEls, boxesEl, submitEl, titleEl, subtitleEl);
  });

  inputEls[0].focus();
}

/* ─── Resend cooldown ──────────────────────────────────────── */
function startResendCooldown(resendEl) {
  let secs = RESEND_SECS;
  resendEl.disabled = true;
  renderResendLabel(resendEl, secs);

  resendCountdown = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearCountdownTimer();
      resendEl.disabled = false;
      resendEl.textContent = t.resend;
      resendEl.onclick = () => resetForm();
    } else {
      renderResendLabel(resendEl, secs);
    }
  }, 1000);
}

function renderResendLabel(el, secs) {
  el.innerHTML = `${t.resendIn} <span class="countdown">${secs}s</span>`;
}

function clearCountdownTimer() {
  if (resendCountdown) {
    clearInterval(resendCountdown);
    resendCountdown = null;
  }
}

/* ─── Verify ───────────────────────────────────────────────── */
function verify(code, inputEls, boxesEl, submitEl, titleEl, subtitleEl) {
  inputEls.forEach((i) => i.classList.add("checking"));
  boxesEl.classList.add("pulse");
  submitEl.disabled = true;

  setTimeout(() => {
    inputEls.forEach((i) => i.classList.remove("checking"));
    boxesEl.classList.remove("pulse");
    submitEl.disabled = false;

    if (code === correctCode) {
      inputEls.forEach((i) => i.classList.add("correct"));
      setTimeout(showSuccess, 350);
    } else {
      attempts++;
      const left = MAX_ATTEMPTS - attempts;

      card.classList.add("wrong");
      titleEl.textContent = t.wrongTitle;
      subtitleEl.innerHTML = t.wrongSubtitle;

      inputEls.forEach((i) => i.classList.add("wrong"));
      boxesEl.classList.add("shake");

      // Show attempt dots
      const existingDots = card.querySelector(".attempt-dots");
      if (existingDots) existingDots.remove();
      if (attempts > 0) {
        const dotsEl = document.createElement("div");
        dotsEl.className = "attempt-dots";
        for (let d = 0; d < attempts; d++) {
          const dot = document.createElement("div");
          dot.className = "attempt-dot";
          dot.style.animationDelay = `${d * 0.08}s`;
          dotsEl.appendChild(dot);
        }
        card.insertBefore(dotsEl, card.querySelector(".resend"));
      }

      if (left <= 0) {
        // Lock immediately after animation
        setTimeout(() => showLocked(), 500);
        return;
      }

      // Show attempts-remaining hint in subtitle after clearing
      setTimeout(() => {
        boxesEl.classList.remove("shake");
        inputEls.forEach((i) => {
          i.value = "";
          i.classList.remove("wrong");
        });
        inputEls[0].focus();
        card.classList.remove("wrong");
        titleEl.textContent = t.title;
        subtitleEl.innerHTML = t.subtitle;

        // keep dots visible between attempts
      }, 900);
    }
  }, 900);
}

/* ─── Lock screen ──────────────────────────────────────────── */
function showLocked() {
  isLocked = true;
  clearCountdownTimer();

  let secs = LOCK_SECS;
  card.className = "card locked";
  renderLockScreen(secs);

  lockTimer = setInterval(() => {
    secs--;
    const timerEl = document.getElementById("lockCountdown");
    if (timerEl) timerEl.textContent = formatTime(secs);
    if (secs <= 0) {
      clearInterval(lockTimer);
      lockTimer = null;
      isLocked = false;
      attempts = 0;
      resetForm();
    }
  }, 1000);
}

function renderLockScreen(secs) {
  card.innerHTML = `
    <span class="lock-icon">🔒</span>
    <h1>${t.lockedTitle}</h1>
    <p>${t.lockedSubtitle}</p>
    <div class="lock-timer" id="lockCountdown">${formatTime(secs)}</div>
  `;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

/* ─── Success screen ───────────────────────────────────────── */
function showSuccess() {
  clearCountdownTimer();
  card.className = "card success";
  card.innerHTML = `
    <h1>${t.successTitle}</h1>
    <p>${t.successSubtitle}</p>
    <div class="check-circle">
      <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
        <circle class="circle-ring" cx="45" cy="45" r="38" />
        <polyline class="check-mark" points="26,46 39,59 64,32" />
      </svg>
    </div>
    <button class="resend" onclick="location.reload()">${t.reset}</button>
  `;
}

/* ─── Init ─────────────────────────────────────────────────── */
applyLanguage("en");
