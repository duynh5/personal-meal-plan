# Personal Meal Plan

Dự án lập kế hoạch bữa sáng và bữa cơm tối gia đình, rồi publish thành trang GitHub Pages.

## Nguồn Sự Thật

- Món ăn nằm trong `data/menu.json`; không chép danh sách món vào hướng dẫn này.
- Script sinh kế hoạch 4 tuần: `scripts/generate-meal-plan.mjs`.
- Script kiểm tra kế hoạch 4 tuần: `scripts/validate-plan.mjs`.
- Script đổi dương lịch sang âm lịch Việt Nam: `scripts/lunar.mjs`.
- Script render giao diện chia sẻ: `scripts/render-site.mjs`, xuất ra `site/`.
- GitHub Actions chạy workflow `.github/workflows/rolling-plan.yml`; GitHub Pages publish thư mục `site/`.

## Quy Tắc Lập Kế Hoạch

- Lập kế hoạch bữa tối từ thứ 2 đến thứ 6.
- Lập kế hoạch bữa sáng từ thứ 2 đến thứ 6.
- Bữa sáng không cần cân bằng theo nhóm món, nhưng không được trùng trong cùng tuần.
- Lập kế hoạch cho 4 tuần kế tiếp, từ thứ 2 đến thứ 6.
- Kế hoạch tự động được tạo hằng tuần vào thứ 6 theo giờ Việt Nam.
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
- Bữa sáng, món chính, món canh, và món xào/luộc không nên lặp lại từ tuần liền trước nếu còn lựa chọn khác phù hợp.
- Món cá có thể trùng trong tuần.
- Món thịt và món gà/trứng không được trùng trong cùng tuần.

## Quy Tắc Đầu Ra

- Khi người dùng yêu cầu lên kế hoạch ăn, tạo hoặc cập nhật `meal-plan.md` bằng script hiện có khi phù hợp.
- Lưu kế hoạch theo thứ tự tuần, rồi theo từng ngày trong tuần.
- Mỗi ngày ghi rõ bữa sáng.
- Mỗi ngày ghi rõ món chính; ngày chay ghi món chính chay.
- Chỉ các bữa có món chính là cơm mới ăn kèm món canh và món xào/luộc.
- Các bữa cháo, mì, bún, hoặc bánh canh chỉ ghi món chính, không thêm món canh hoặc món xào/luộc.

## Vận Hành

- Chạy local:
  - `node scripts/generate-meal-plan.mjs`
  - `node scripts/validate-plan.mjs`
  - `node --test scripts/*.test.mjs`
  - `node scripts/render-site.mjs`
- Chạy tự động:
  - Workflow chạy lúc 08:00 giờ Việt Nam mỗi thứ 6.
  - Script luôn ghi kế hoạch cho 4 tuần kế tiếp theo `Asia/Ho_Chi_Minh`.
  - Workflow kiểm tra `meal-plan.json` trước khi render site.
  - Workflow chạy test hồi quy validator trước khi render site.
  - Workflow commit lại `meal-plan.md`, `meal-plan.json`, và `site/`.
  - Workflow publish GitHub Pages chạy sau khi workflow rolling hoàn tất thành công.
- `scripts/plan-rolling.sh` chỉ là dự phòng local, không phải nguồn tự động hóa chính.
