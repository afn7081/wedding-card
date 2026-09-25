const cover = document.querySelector("#cover");
const invitation = document.querySelector("#invitation");
const openCard = document.querySelector("#open-card");
const closeCard = document.querySelector("#close-card");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const address = "Centurion Banquet Hall, 3rd Floor, Haware's Centurion Mall, Sector 19A, Nerul, Navi Mumbai";
const weddingDay = new Date("2026-12-04T00:00:00+05:30");
const followingDay = new Date("2026-12-05T00:00:00+05:30");
let opening = false;
let toastTimeout;
let navigationFrame = 0;

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

const navLinks = [...document.querySelectorAll(".nav-link")];
const navSections = navLinks.map((link) => document.querySelector(link.getAttribute("href")));

function updateNavigation() {
  navigationFrame = 0;
  if (invitation.hidden) return;
  let activeIndex = 0;
  navSections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= window.innerHeight * 0.45) activeIndex = index;
  });
  navLinks.forEach((link, index) => {
    if (index === activeIndex) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

window.addEventListener("scroll", () => {
  if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation);
}, { passive: true });

function showToast(message) {
  const toast = document.querySelector("#toast");
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.hidden = false;
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 6000);
}

let revealObserver;
if ("IntersectionObserver" in window && !reducedMotion.matches) {
  document.body.classList.add("motion-ready");
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
}

if ("IntersectionObserver" in window) {
  const ambienceObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-in-view", entry.isIntersecting);
    });
  }, { threshold: 0.05 });
  document.querySelectorAll("#invitation > section").forEach((section) => ambienceObserver.observe(section));
}

function revealInvitation() {
  document.title = "Afnan & Zainab | A celebration of love";
  invitation.hidden = false;
  invitation.inert = false;
  document.body.classList.add("invitation-open");
  document.body.classList.remove("is-unsealing");
  cover.hidden = true;
  openCard.setAttribute("aria-expanded", "true");
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelector("#couple-heading").focus({ preventScroll: true });
  updateNavigation();
  document.querySelectorAll(".reveal").forEach((element) => {
    if (revealObserver) revealObserver.observe(element);
  });
}

openCard.addEventListener("click", async () => {
  if (opening) return;
  opening = true;
  openCard.disabled = true;
  invitation.hidden = false;
  invitation.inert = true;
  document.body.classList.add("invitation-open", "is-unsealing");
  window.scrollTo({ top: 0, behavior: "instant" });
  cover.classList.add("is-opening");
  if (!reducedMotion.matches) {
    await wait(1850);
    cover.classList.add("is-leaving");
    await wait(400);
  }
  revealInvitation();
  openCard.disabled = false;
  opening = false;
});

closeCard.addEventListener("click", () => {
  document.title = "A special invitation";
  invitation.hidden = true;
  cover.hidden = false;
  cover.classList.remove("is-opening", "is-leaving");
  document.body.classList.remove("invitation-open");
  openCard.setAttribute("aria-expanded", "false");
  if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  window.scrollTo({ top: 0, behavior: "instant" });
  openCard.focus({ preventScroll: true });
});

function updateCountdown() {
  const now = Date.now();
  const remaining = Math.max(0, weddingDay.getTime() - now);
  const units = {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor(remaining / 3600000) % 24,
    minutes: Math.floor(remaining / 60000) % 60,
    seconds: Math.floor(remaining / 1000) % 60,
  };
  for (const [unit, value] of Object.entries(units)) {
    document.getElementById(unit).textContent = String(value).padStart(2, "0");
  }
  const onWeddingDay = now >= weddingDay.getTime() && now < followingDay.getTime();
  const afterWeddingDay = now >= followingDay.getTime();
  document.querySelector("#countdown-label").textContent = onWeddingDay
    ? "THE DAY WE HAVE BEEN WAITING FOR"
    : afterWeddingDay ? "A BEAUTIFUL BEGINNING, FOREVER CHERISHED" : "COUNTING THE DAYS TO OUR CELEBRATION";
  document.querySelector("#countdown-message").textContent = onWeddingDay
    ? "Today, we celebrate together."
    : afterWeddingDay ? "Forever grateful for your love and duas." : "Some days are worth waiting for.";
  document.querySelector("#countdown").hidden = onWeddingDay || afterWeddingDay;
  document.querySelector(".countdown-note").hidden = onWeddingDay || afterWeddingDay;
}

updateCountdown();
window.setInterval(updateCountdown, 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateCountdown();
});

function escapeCalendarText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let currentLine = "";
  let byteLength = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (byteLength + size > 75) {
      lines.push(currentLine);
      currentLine = " ";
      byteLength = 1;
    }
    currentLine += character;
    byteLength += size;
  }
  lines.push(currentLine);
  return lines.join("\r\n");
}

document.querySelector("#save-date").addEventListener("click", () => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Afnan and Zainab//Walima Invitation//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:afnan-zainab-walima-20261204@invitation.local",
    `DTSTAMP:${stamp}`,
    "DTSTART;VALUE=DATE:20261204",
    "DTEND;VALUE=DATE:20261205",
    "SUMMARY:Walima of Afnan Khan and Zainab Al Afifa",
    `LOCATION:${escapeCalendarText(address)}`,
    `DESCRIPTION:${escapeCalendarText("Mr. & Mrs. Aslam Khan invite you to the Walima of Afnan Khan with Zainab Al Afifa, daughter of Mr. Moidur Rahman and Mrs. Benazir Ara.\nThe invitation does not specify a time. Please check with the family. This is an all-day date reminder, not an all-day event.")}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(foldCalendarLine).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = "Afnan-and-Zainab-4-December-2026.ics";
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast("Your calendar file is ready. Open it to save the date.");
});

document.querySelector("#copy-address").addEventListener("click", async () => {
  if (!navigator.clipboard?.writeText) {
    showToast("Copying isn’t available in this browser. Please select the venue address to copy it.");
    return;
  }
  try {
    await navigator.clipboard.writeText(address);
    showToast("Venue address copied. See you there!");
  } catch (error) {
    console.error("Could not copy the venue address:", error);
    showToast("The browser blocked copying. Please select the venue address to copy it.");
  }
});

if (["#our-invitation", "#celebration", "#venue"].includes(window.location.hash)) {
  revealInvitation();
  requestAnimationFrame(() => {
    document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "instant" });
  });
}
