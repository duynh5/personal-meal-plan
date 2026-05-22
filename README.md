# Personal Meal Plan

Du an lap ke hoach bua sang va bua toi gia dinh, roi publish thanh trang GitHub Pages.

## Chay local

```sh
node scripts/generate-meal-plan.mjs
node scripts/validate-plan.mjs
node --test scripts/*.test.mjs
node scripts/render-site.mjs
```

Mo `site/index.html` de xem giao dien local.

## Giao dien web

- Giao dien su dung co dinh theme `Tuoi`.
- Thanh thao tac gom: den mon hom nay, kho mon tham khao, len dau trang, in/luu PDF.
- Tren mobile, dieu huong tuan duoc toi uu cho cuon ngang va tu dong danh dau tuan dang xem.
- Trang co muc `Kho mon` duoc render tu `data/menu.json`, nhom theo loai de nguoi nha tham khao mon co the xuat hien trong lich.

## Du lieu menu

- `data/menu.json` la nguon du lieu mon an.
- `breakfasts` dung object `{ "name", "category", "vegetarian" }`; `category` la nhan tieng Anh de script rai deu loai bua sang.
- `soups` dung object `{ "name", "profile", "vegetarian" }`; `profile` la `light` hoac `protein` de uu tien canh nhe khi an com.
- `sides` dung object `{ "name", "vegetarian" }`.
- Ke hoach xuat ra van giu ten mon an dang chuoi, khong hien cac nhan metadata nay.
- Ngay chay am lich chi duoc chon bua sang va mon chinh chay; neu co canh hoac xao/luoc thi cung phai co `vegetarian: true`.
- Khi con lua chon hop le, script uu tien tranh trung `breakfast`, `main`, `soup`, va `side` trong toan bo ke hoach 4 tuan.

## Tu dong tren GitHub

- `.github/workflows/rolling-plan.yml` chay luc 08:00 gio Viet Nam moi thu 6.
- Script sinh ke hoach cho 4 tuan ke tiep theo `Asia/Ho_Chi_Minh`.
- Chay tay vao thu 2-thu 5 se bao gom tuan hien tai; chay thu 6-cuoi tuan se bat dau tu thu 2 tuan ke tiep.
- Khi `meal-plan.json` da co du lieu chong lap, script giu nguyen cac tuan da cong bo va chi sinh them cac tuan con thieu de du 4 tuan.
- Workflow validate `meal-plan.json` truoc khi render site.
- Workflow commit lai `meal-plan.md`, `meal-plan.json`, va `site/`.
- `.github/workflows/pages.yml` publish thu muc `site/` len GitHub Pages sau khi rolling workflow hoan tat thanh cong.

## Cai dat GitHub Pages

1. Dua repo len GitHub.
2. Vao `Settings -> Pages`.
3. Chon source la `GitHub Actions`.
4. Chay workflow `Publish meal plan site` lan dau neu can.
5. Chia se URL GitHub Pages cho nguoi nha.

## Chay thu workflow

Vao tab `Actions`, chon `Rolling meal plan`, bam `Run workflow`.
