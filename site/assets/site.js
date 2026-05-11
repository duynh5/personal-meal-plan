const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const todayCard = document.querySelector(`[data-date="${today}"]`);
const status = document.querySelector("#today-status");
const printButton = document.querySelector("#print-button");
const todayButton = document.querySelector("#today-button");
const topButton = document.querySelector("#top-button");
const notesToggle = document.querySelector("#notes-toggle");
const themeButtons = Array.from(document.querySelectorAll(".theme-toggle__button"));
const weekNavLinks = Array.from(document.querySelectorAll(".week-nav__link"));
const weekSections = Array.from(document.querySelectorAll(".week-section[data-week]"));
const notesLists = Array.from(document.querySelectorAll(".notes"));
const themeStorageKey = "meal-plan-theme";
const notesStorageKey = "meal-plan-hide-notes";

const defaultTheme = "fresh";
const savedTheme = window.localStorage.getItem(themeStorageKey);
const activeTheme = themeButtons.some((button) => button.dataset.theme === savedTheme)
  ? savedTheme
  : defaultTheme;

function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
  window.localStorage.setItem(themeStorageKey, themeName);

  for (const button of themeButtons) {
    const isActive = button.dataset.theme === themeName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

if (themeButtons.length > 0) {
  applyTheme(activeTheme);

  for (const button of themeButtons) {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.theme ?? defaultTheme);
    });
  }
}

function applyNotesVisibility(hideNotes) {
  for (const notes of notesLists) {
    notes.classList.toggle("is-hidden", hideNotes);
  }

  if (notesToggle) {
    notesToggle.textContent = hideNotes ? "Hiện ghi chú" : "Ẩn ghi chú";
    notesToggle.setAttribute("aria-pressed", String(hideNotes));
  }
}

function setActiveWeek(weekId) {
  for (const link of weekNavLinks) {
    const isActive = link.dataset.weekTarget === weekId;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "true" : "false");
    if (isActive) {
      link.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }
}

if (weekSections.length > 0 && weekNavLinks.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length === 0) {
        return;
      }

      visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const weekId = visibleEntries[0].target.getAttribute("data-week");
      if (weekId) {
        setActiveWeek(weekId);
      }
    },
    { rootMargin: "-35% 0px -50% 0px", threshold: [0.2, 0.35, 0.5] }
  );

  for (const section of weekSections) {
    observer.observe(section);
  }
}

if (notesToggle && notesLists.length > 0) {
  const hideNotesOnLoad = window.localStorage.getItem(notesStorageKey) === "true";
  applyNotesVisibility(hideNotesOnLoad);

  notesToggle.addEventListener("click", () => {
    const nextState = !notesLists[0].classList.contains("is-hidden");
    applyNotesVisibility(nextState);
    window.localStorage.setItem(notesStorageKey, String(nextState));
  });
}

if (status && todayCard) {
  const weekday = todayCard.querySelector(".day-card__weekday");
  const dateHeading = todayCard.querySelector("h3");

  todayCard.classList.add("is-today");
  status.textContent =
    weekday && dateHeading
      ? `Hôm nay: ${weekday.textContent}, ${dateHeading.textContent}`
      : "Hôm nay có trong lịch ăn 4 tuần này.";
} else if (status) {
  status.textContent = "Hôm nay không nằm trong lịch ăn 4 tuần này.";
}

if (printButton) {
  printButton.addEventListener("click", () => {
    window.print();
  });
}

if (todayButton && todayCard) {
  todayButton.addEventListener("click", () => {
    todayCard.scrollIntoView({ behavior: "smooth", block: "start" });
    const heading = todayCard.querySelector("h3");
    if (heading instanceof HTMLElement) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  });
}

if (topButton) {
  topButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
