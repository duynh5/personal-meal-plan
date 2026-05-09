# Personal Meal Plan

Dự án lập kế hoạch bữa cơm tối gia đình và publish thành trang GitHub Pages.

## Nguồn Sự Thật

- Món ăn nằm trong `data/menu.json`; không chép danh sách món vào hướng dẫn này.
- Script sinh kế hoạch tháng: `scripts/generate-meal-plan.mjs`.
- Script đổi dương lịch sang âm lịch Việt Nam: `scripts/lunar.mjs`.
- Script render giao diện chia sẻ: `scripts/render-site.mjs`, xuất ra `site/`.
- GitHub Actions chạy workflow `.github/workflows/monthly-plan.yml`; GitHub Pages publish thư mục `site/`.

## Quy Tắc Lập Kế Hoạch

- Lập kế hoạch bữa tối từ thứ 2 đến thứ 6.
- Khi lập kế hoạch theo tháng, lập cho toàn bộ các ngày thứ 2 đến thứ 6 trong tháng đó.
- Kế hoạch tháng tự động được tạo vào ngày cuối cùng của tháng trước theo giờ Việt Nam.
- Mỗi tuần đủ 5 ngày nên cân bằng:
  - 2 ngày cá.
  - 2 ngày bò hoặc heo.
  - 1 ngày gà hoặc trứng.
- Các nhóm món mặn nên được sắp xếp xen kẽ, tránh đặt cùng nhóm quá sát nhau khi có thể.
- Tinh bột mỗi tuần đủ 5 ngày nên gồm:
  - 3 ngày cơm hoặc cháo.
  - 2 ngày mì, bún, hoặc bánh canh.
- Ngày chay là mùng 1 và ngày 15 âm lịch Việt Nam, được xác định tự động bằng `scripts/lunar.mjs`.
- Khi có ngày chay trong tuần, ngày đó thay thế một ngày mặn; các ngày còn lại vẫn cân bằng nhóm món nhiều nhất có thể.
- Ngày thường có thể ăn món chay hoặc món mặn.
- Món cá có thể trùng trong tuần.
- Món thịt và món gà/trứng không được trùng trong cùng tuần.

## Quy Tắc Đầu Ra

- Khi người dùng yêu cầu lên kế hoạch ăn, tạo hoặc cập nhật `meal-plan.md` bằng script hiện có khi phù hợp.
- Lưu kế hoạch theo thứ tự tuần, rồi theo từng ngày trong tuần.
- Mỗi ngày ghi rõ món chính; ngày chay ghi món chính chay.
- Chỉ các bữa có món chính là cơm mới ăn kèm món canh và món xào/luộc.
- Các bữa cháo, mì, bún, hoặc bánh canh chỉ ghi món chính, không thêm món canh hoặc món xào/luộc.

## Vận Hành

- Chạy local:
  - `TARGET_MONTH=2026-06 node scripts/generate-meal-plan.mjs`
  - `node scripts/render-site.mjs`
- Chạy tự động:
  - Workflow chạy lúc 08:00 giờ Việt Nam trong các ngày 28-31 hằng tháng.
  - Script chỉ ghi kế hoạch mới khi ngày hiện tại là ngày cuối tháng theo `Asia/Ho_Chi_Minh`.
  - Workflow commit lại `meal-plan.md`, `meal-plan.json`, và `site/`.
- `scripts/plan-next-month.sh` chỉ là dự phòng local, không phải nguồn tự động hóa chính.
