# 庭院植物守衛 3D

一款受經典「植物防守殭屍」玩法啟發的純網頁 3D 塔防小遊戲。角色由 Three.js 基本幾何圖形建立，庭院景物使用免費 CC0 3D 模型，不含受版權保護的原作素材。

## 功能

- 5 條草地路線、9 欄可放置區域
- 4 種植物：豆豆射手、陽光花、堅果盾、冰豆射手
- 陽光資源、植物冷卻、殭屍攻擊、冰凍減速
- 5 波漸進式難度
- 桌面與手機觸控操作
- 滑鼠或觸控拖曳旋轉視角、滾輪縮放
- Kenney Nature Kit 的低多邊形樹木、灌木與岩石
- 純前端，不需要伺服器或資料庫

## 本機啟動

ES Module 需要由 HTTP 伺服器開啟：

```bash
python3 -m http.server 8000
```

瀏覽器開啟 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 建立新的 GitHub Repository。
2. 上傳 `index.html`、`style.css`、`game.js`。
3. 到 **Settings → Pages**。
4. Source 選擇 **Deploy from a branch**。
5. Branch 選擇 `main` 與 `/ (root)`，儲存。
6. 等待 GitHub Pages 產生公開網址。

## 技術

- HTML5
- CSS3
- JavaScript ES Modules
- Three.js（透過 CDN 載入）
- Three.js OrbitControls、GLTFLoader

## 3D 模型素材

庭院中的樹木、灌木與岩石取自 [Kenney Nature Kit](https://opengameart.org/content/nature-kit)，採用 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 授權。素材作者為 Kenney，署名非強制但在此致謝。

## 授權與名稱提醒

本專案不含《植物大戰殭屍》的名稱、圖片、音效或模型素材。公開發布時，建議使用自己的遊戲名稱、角色造型與美術資源。
