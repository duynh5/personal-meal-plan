const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const todayCard = document.querySelector(`[data-date="${today}"]`);
const status = document.querySelector("#today-status");
const printButton = document.querySelector("#print-button");

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
