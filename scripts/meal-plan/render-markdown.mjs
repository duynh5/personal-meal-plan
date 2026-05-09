export function renderMarkdown(plan) {
  const lines = [`# ${plan.metadata.title}`, ""];

  for (const week of plan.weeks) {
    lines.push(`## ${week.title}`, "");
    for (const note of week.notes) {
      lines.push(`Ghi chú: ${note}`);
    }
    lines.push("");

    for (const day of week.days) {
      lines.push(`### ${day.weekday} - ${day.displayDate}`, "");
      lines.push(`- Ngày âm: ${day.lunarDate}`);
      lines.push(`- Bữa sáng: ${day.breakfast}`);
      lines.push(`- ${day.vegetarianDay ? "Món chính" : "Món mặn chính"}: ${day.main}`);
      if (day.soup) {
        lines.push(`- Món canh: ${day.soup}`);
      }
      if (day.side) {
        lines.push(`- Món xào/luộc: ${day.side}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
