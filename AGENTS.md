# Personal Meal Plan

Đây là dự án lên kế hoạch bữa cơm tối hằng ngày.

## Quy Tắc Lập Kế Hoạch Tuần

- Lập kế hoạch cho 5 bữa cơm tối trong tuần, từ thứ 2 đến thứ 6.
- Khi lập kế hoạch theo tháng, hãy lập cho toàn bộ các tuần thứ 2 đến thứ 6 trong tháng đó.
- Lịch tự động lập kế hoạch tháng chạy vào ngày cuối cùng của tháng trước. Ví dụ: lập kế hoạch tháng 6 vào ngày 31/5.
- Món mặn mỗi tuần phải gồm:
  - 2 ngày cá.
  - 2 ngày thịt bò hoặc heo.
  - 1 ngày gà hoặc trứng.
- Các nhóm món mặn cần được sắp xếp xen kẽ nhau, tránh đặt cùng nhóm quá sát nhau khi có thể.
- Tinh bột mỗi tuần phải gồm:
  - 3 ngày cơm hoặc cháo.
  - 2 ngày mì, bún, hoặc bánh canh.
- Các ngày chay theo lịch âm chỉ ăn món chay.
- Khi có ngày chay âm lịch trong tuần, ngày đó thay thế một ngày mặn; các ngày còn lại vẫn cân bằng nhóm món nhiều nhất có thể.
- Ngày thường thì chay hay không chay đều được.
- Các món cá có thể trùng trong tuần.
- Các món thịt và gà/trứng không được trùng trong cùng tuần.

## Quy Tắc Đầu Ra

- Khi người dùng yêu cầu lên kế hoạch ăn cho tuần, hãy tạo hoặc cập nhật `meal-plan.md`.
- Lưu kế hoạch trong `meal-plan.md` theo thứ tự:
  - Theo tuần.
  - Sau đó theo từng ngày trong tuần.
- Mỗi ngày nên ghi rõ món mặn chính.
- Chỉ các bữa có món chính là cơm mới ăn kèm món canh và món xào/luộc.
- Các bữa cháo, mì, bún, hoặc bánh canh chỉ ghi món chính, không thêm món canh hoặc món xào/luộc.
- Khi có ngày chay theo lịch âm trong tuần được lập kế hoạch, chỉ chọn món chay cho ngày đó. Nếu thiếu thông tin để xác định ngày chay, hãy hỏi lại hoặc ghi rõ giả định trước khi lập kế hoạch.

## Tự Động Hóa

- Dữ liệu món ăn cho tự động hóa nằm trong `data/menu.json`.
- Script sinh kế hoạch tháng: `scripts/generate-meal-plan.mjs`.
- Script render giao diện chia sẻ: `scripts/render-site.mjs`, xuất ra thư mục `site/`.
- GitHub Actions tự động chạy vào 08:00 giờ Việt Nam trong các ngày 28-31 hằng tháng; script sẽ chỉ ghi kế hoạch mới vào ngày cuối tháng.
- GitHub Pages publish thư mục `site/` để người nhà mở link xem kế hoạch.
- Script cron cục bộ `scripts/plan-next-month.sh` chỉ là dự phòng local, không phải nguồn tự động hóa chính.

## Danh Sách Món Mặn

- cơm bò bít tết + khoai tây
- cơm bò xào cà chua dưa leo
- cơm heo ba rọi kho
- cơm heo kho tàu
- cơm heo kho mặn
- cơm heo kho đậu hủ
- cơm heo cốt lết chiên
- cơm heo tấm nướng
- cơm heo quay cải chua
- cơm heo ragu
- cơm heo thịt bằm chiên
- cơm gà luộc nước mắm
- cơm gà hấp muối
- cơm gà nướng muối
- cơm gà kho gừng
- cơm gà kho tỏi ớt
- cháo gà gỏi
- cơm cá cơm kho + trứng chiên thịt bằm
- cơm cá chưng tương + nắm mèo + bún tàu
- cơm cá chiên
- cơm cá kho
- bún bò xáo
- bún heo mộc
- bún thịt nướng
- bún chả giò
- (chay) bún nước tương tàu hủ
- (chay) mì xào chay
- mì heo xào
- mì gà nước
- bánh canh heo giò
- bánh canh cá

## Danh Sách Món Canh

- canh khoai mỡ
- canh bí đỏ
- canh bí đao
- canh bầu
- canh súp thịt heo
- canh khoai sọ
- canh cải bó xôi
- canh rau dền
- canh rau mồng tơi
- canh cá thác lác thơm cà
- canh chua
- canh bún tàu thịt bằm
- canh nấm giò lụa
- canh cải xanh
- canh rau muống tôm
- canh rau tần ô
- canh xà lách xoong

## Danh Sách Món Xào/Luộc

- bắp cải xào
- cà rốt xào
- cà rốt luộc
- đậu que xào
- đậu que luộc
- bông bí xào
- rau muống xào
- rau lang luộc
- bầu luộc
- giá hẹ xào
- măng tây xào
- khổ qua xào trứng
- măng vàng xào
