# Personal Meal Plan

Du an lap ke hoach bua toi gia dinh va publish thanh trang GitHub Pages.

## Chay local

```sh
node scripts/generate-meal-plan.mjs
node scripts/validate-plan.mjs
node scripts/render-site.mjs
```

Mo `site/index.html` de xem giao dien local.

## Tu dong tren GitHub

- `.github/workflows/rolling-plan.yml` chay luc 08:00 gio Viet Nam moi thu 6.
- Script sinh ke hoach cho 4 tuan ke tiep theo `Asia/Ho_Chi_Minh`.
- Workflow validate `meal-plan.json` truoc khi render site.
- Workflow commit lai `meal-plan.md`, `meal-plan.json`, va `site/`.
- `.github/workflows/pages.yml` publish thu muc `site/` len GitHub Pages.

## Cai dat GitHub Pages

1. Dua repo len GitHub.
2. Vao `Settings -> Pages`.
3. Chon source la `GitHub Actions`.
4. Chay workflow `Publish meal plan site` lan dau neu can.
5. Chia se URL GitHub Pages cho nguoi nha.

## Chay thu workflow

Vao tab `Actions`, chon `Rolling meal plan`, bam `Run workflow`.
