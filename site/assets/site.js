const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const todayCard = document.querySelector(`[data-date="${today}"]`);
const status = document.querySelector("#today-status");
const printButton = document.querySelector("#print-button");

if (todayCard) {
  todayCard.classList.add("is-today");
  status.textContent = `Hôm nay: ${todayCard.querySelector(".day-card__weekday").textContent}, ${
    todayCard.querySelector("h3").textContent
  }`;
} else {
  status.textContent = "Hôm nay không nằm trong lịch ăn tháng này.";
}

printButton.addEventListener("click", () => {
  window.print();
});
