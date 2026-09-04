#!/usr/bin/env python3
"""LayCAT アノテウィンドウ（Cryptomatte 表示中）の再現画像。
ユーザー提供の実スクショに合わせた配色・ボタン形状。
・青いスライダートラック＋青い丸ノブ（露出／ガンマ）
・赤い削除ボタン
・👁 アクティブ（白背景+暗い文字）
・下段のヘルプパネル
・右のコメント/FB 欄
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

os.makedirs('slides_assets', exist_ok=True)
FONT_JP = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
def font(size): return ImageFont.truetype(FONT_JP, size)

SPHERES = [
    (0.32, 0.62, 0.15, (220, 100, 90)),
    (0.55, 0.58, 0.12, (110, 180, 220)),
    (0.75, 0.68, 0.10, (210, 200, 110)),
]

def draw_crypto_scene(cw, ch):
    """Cryptomatte プレビュー：黒背景 + 各球体が固定ハッシュ色、床は青系"""
    im = Image.new('RGB', (cw, ch), (0, 0, 0))
    ccols = [(240,120,90), (100,220,180), (180,120,240)]
    horizon = int(ch * 0.55)
    for y in range(horizon, ch):
        for x in range(cw):
            im.putpixel((x,y), (60, 100, 200))
    for idx,(nx, ny, nr, _) in enumerate(SPHERES):
        cx, cy, r = nx*cw, ny*ch, nr*min(cw,ch)
        col = ccols[idx]
        for py in range(max(0,int(cy-r)), min(ch,int(cy+r+1))):
            for px in range(max(0,int(cx-r)), min(cw,int(cx+r+1))):
                dx, dy = px-cx, py-cy
                if dx*dx + dy*dy > r*r: continue
                im.putpixel((px, py), col)
    return im

def gen_anno_window_crypto():
    W, H = 1600, 900
    # 実際の LayCAT カラーパレット
    BG      = (13, 13, 15)
    BG2     = (20, 20, 22)
    BG3     = (28, 28, 31)
    BORDER  = (42, 42, 47)
    BORDER2 = (58, 58, 66)
    TEXT    = (232, 232, 236)
    TEXT2   = (154, 154, 170)
    TEXT3   = (90, 90, 106)
    ACTIVE_BG = (236, 236, 240)
    ACTIVE_FG = (22, 22, 26)
    BLUE      = (96, 165, 255)   # スライダートラック・focus
    DANGER    = (232, 90, 90)    # 削除ボタン背景

    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ============================================================
    # トップバー
    # ============================================================
    top_h = 52
    draw.rectangle([0, 0, W, top_h], fill=BG2)
    draw.line([(0, top_h), (W, top_h)], fill=BORDER, width=1)

    x = 14
    # タイトル（サンプル・個人情報なし）
    title = 'カット名 — v004'
    draw.text((x, 18), title, font=font(15), fill=TEXT)
    tw = draw.textbbox((0,0), title, font=font(15))[2]
    x += tw + 14
    # ステータスバッジ（緑）
    st_bg = (32, 80, 48); st_txt = (110, 220, 150)
    draw.rounded_rectangle([x, 15, x+88, 39], radius=5, fill=st_bg)
    draw.text((x+10, 19), 'チェック待ち', font=font(12), fill=st_txt)
    x += 100
    # by / date（汎用表記）
    draw.text((x, 19), 'by 作業者・00:55', font=font(12), fill=TEXT2)
    x += 200
    # ステータス切替 select
    draw.rounded_rectangle([x, 12, x+130, 42], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((x+12, 20), 'チェック待ち  ▾', font=font(13), fill=TEXT)
    x += 146
    # レイヤー select
    draw.rounded_rectangle([x, 12, x+200, 42], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((x+12, 20), 'crypto_asset (BGR)  ▾', font=font(13), fill=TEXT)
    x += 216
    # 露出／ガンマ スライダ（青トラック + 青い丸ノブ）
    def slider(xx, label, val, val_pos, w=160):
        # ラベル
        draw.text((xx, 21), label, font=font(12), fill=TEXT2)
        lbw = draw.textbbox((0,0), label, font=font(12))[2]
        # トラック
        tx0 = xx + lbw + 8
        ty = 26
        tw = w - lbw - 38
        draw.rectangle([tx0, ty-1, tx0+tw, ty+2], fill=BLUE)
        # 青い丸ノブ
        kx = tx0 + int(tw*val_pos)
        draw.ellipse([kx-7, ty-6, kx+7, ty+8], fill=BLUE, outline=(255,255,255), width=1)
        # 数値
        draw.text((xx+w-32, 21), val, font=font(12), fill=TEXT)
    slider(x, '露出', '0.0', 0.5, w=160); x += 168
    slider(x, 'ガンマ', '2.20', 0.5, w=180); x += 186
    # リセットボタン
    draw.rounded_rectangle([x, 12, x+32, 42], radius=6, fill=BG3, outline=BORDER, width=1)
    draw.text((x+10, 20), '↺', font=font(14), fill=TEXT2); x += 40
    # サムネ更新
    draw.rounded_rectangle([x, 12, x+130, 42], radius=6, fill=BG3, outline=BORDER, width=1)
    draw.text((x+10, 20), '🖼 サムネ更新', font=font(13), fill=TEXT); x += 140
    # 右端：削除（赤）／閉じる
    x = W - 90
    draw.rounded_rectangle([x, 12, x+36, 42], radius=6, fill=DANGER)
    draw.text((x+11, 19), '🗑', font=font(15), fill=(255,240,240))
    x += 44
    # ×（閉じる）
    draw.text((x, 14), '×', font=font(26), fill=TEXT2)

    # ============================================================
    # ツールバー
    # ============================================================
    tb_y = top_h + 2
    tb_h = 42
    draw.rectangle([0, tb_y, W, tb_y+tb_h], fill=BG2)
    draw.line([(0, tb_y+tb_h), (W, tb_y+tb_h)], fill=BORDER, width=1)

    def ghost(x, y, w, h, label, active=False, radius=6):
        if active:
            draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=ACTIVE_BG)
            draw.text((x+10, y+(h-14)//2), label, font=font(13), fill=ACTIVE_FG)
        else:
            draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, outline=BORDER, width=1)
            draw.text((x+10, y+(h-14)//2), label, font=font(13), fill=TEXT2)

    tx = 14
    # ペン OFF
    ghost(tx, tb_y+8, 92, 28, '◌ ペン OFF'); tx += 100
    # ブラシ 4 select
    draw.rounded_rectangle([tx, tb_y+8, tx+92, tb_y+36], radius=6, fill=BG3, outline=BORDER, width=1)
    draw.text((tx+10, tb_y+14), 'ブラシ 4 ▾', font=font(13), fill=TEXT); tx += 102
    # 筆圧
    ghost(tx, tb_y+8, 74, 28, '✒ 筆圧'); tx += 84
    # 顔ガイド
    ghost(tx, tb_y+8, 104, 28, '◐ 顔の向き'); tx += 114
    # カラーパレット（丸）
    colors_hex = ['#ff4d4d','#ff9f2e','#ffe34d','#4dff88','#4da6ff','#ffffff','#111111']
    for c in colors_hex:
        h_,s_,v_ = int(c[1:3],16), int(c[3:5],16), int(c[5:7],16)
        draw.ellipse([tx, tb_y+13, tx+20, tb_y+33], fill=(h_,s_,v_))
        tx += 22
    tx += 4
    # カスタム色（四角、選択中は赤）
    draw.rounded_rectangle([tx, tb_y+11, tx+34, tb_y+35], radius=3, fill=(255,77,77), outline=BORDER, width=1)
    tx += 42
    # 👁 表示（アクティブ）
    ghost(tx, tb_y+8, 40, 28, '👁', active=True); tx += 50
    # トレペ 0%
    ghost(tx, tb_y+8, 86, 28, 'トレペ 0%'); tx += 96
    # レイヤー
    ghost(tx, tb_y+8, 96, 28, '▤ レイヤー'); tx += 106
    # Undo/Redo/クリア
    ghost(tx, tb_y+8, 34, 28, '↩'); tx += 42
    ghost(tx, tb_y+8, 34, 28, '↪'); tx += 42
    ghost(tx, tb_y+8, 60, 28, 'クリア')

    # ============================================================
    # メインエリア（左：キャンバス、右：コメント/FB）
    # ============================================================
    main_y = tb_y + tb_h + 2
    right_w = 340
    ctr_h = 56
    canvas_x = 0
    canvas_y = main_y
    canvas_w = W - right_w
    canvas_h = H - main_y - ctr_h

    # キャンバス（黒）
    draw.rectangle([canvas_x, canvas_y, canvas_x+canvas_w, canvas_y+canvas_h], fill=(0,0,0))
    # Cryptomatte 表示（1920×1080 想定を中央に）
    img_ratio = 1920/1080
    max_iw = canvas_w - 60
    max_ih = canvas_h - 60
    iw = min(max_iw, int(max_ih*img_ratio))
    ih = int(iw/img_ratio)
    if ih > max_ih:
        ih = max_ih; iw = int(ih*img_ratio)
    ix = canvas_x + (canvas_w - iw)//2
    iy = canvas_y + (canvas_h - ih)//2
    crypto = draw_crypto_scene(iw, ih)
    img.paste(crypto, (ix, iy))

    # ============================================================
    # 右パネル（コメント / FB）
    # ============================================================
    rx = W - right_w
    draw.rectangle([rx, main_y, W, H], fill=BG)  # 少し暗めの背景
    draw.line([(rx, main_y), (rx, H)], fill=BORDER, width=1)
    # ヘッダ
    draw.text((rx+16, main_y+16), 'コメント / FB', font=font(14), fill=TEXT2)
    draw.line([(rx+12, main_y+46), (W-12, main_y+46)], fill=BORDER, width=1)

    def comment(y, name, time, text, has_shot=False):
        ch_h = 110 if has_shot else 66
        draw.rounded_rectangle([rx+12, y, W-12, y+ch_h], radius=8, fill=BG2, outline=BORDER, width=1)
        draw.text((rx+22, y+9), name, font=font(12), fill=TEXT)
        nw = draw.textbbox((0,0), name, font=font(12))[2]
        draw.text((rx+22+nw+6, y+10), '・'+time, font=font(11), fill=TEXT3)
        draw.text((rx+22, y+30), text, font=font(12), fill=TEXT2)
        if has_shot:
            mini = draw_crypto_scene(80, 45)
            img.paste(mini, (rx+22, y+56))

    comment(main_y+60, '作業者', '00:57',
            'この車のマスクを抽出してください',
            has_shot=True)
    comment(main_y+185, 'ディレクター', '01:12',
            'クリプトで確認、OK です',
            has_shot=False)

    # 入力欄（右下）
    inp_y = H - 110
    draw.rounded_rectangle([rx+12, inp_y, W-92, inp_y+92], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((rx+22, inp_y+14), 'コメント…（@メンショ', font=font(12), fill=TEXT3)
    draw.text((rx+22, inp_y+34), 'ン・Ctrl+Enter で送信）', font=font(12), fill=TEXT3)
    # 送信ボタン（白 primary）
    draw.rounded_rectangle([W-82, inp_y+22, W-14, inp_y+70], radius=6, fill=ACTIVE_BG)
    draw.text((W-62, inp_y+38), '送信', font=font(15), fill=ACTIVE_FG)

    # ============================================================
    # 下部：ズームコントロール + ヘルプパネル
    # ============================================================
    ctr_y = canvas_y + canvas_h
    draw.rectangle([0, ctr_y, W-right_w, H], fill=BG2)
    draw.line([(0, ctr_y), (W-right_w, ctr_y)], fill=BORDER, width=1)
    cx = 14
    for lbl in ['🔍+', '🔍−']:
        ghost(cx, ctr_y+12, 38, 32, lbl, radius=6); cx += 46
    draw.text((cx, ctr_y+20), '100%', font=font(13), fill=TEXT); cx += 60
    ghost(cx, ctr_y+12, 56, 32, '等倍', radius=6); cx += 66
    ghost(cx, ctr_y+12, 104, 32, '✋ トラック', radius=6); cx += 114
    ghost(cx, ctr_y+12, 76, 32, '⇋ 反転', radius=6)

    # ヘルプパネル（右寄り・カード風）
    hp_x = W - right_w - 460
    hp_y = ctr_y + 6
    hp_w = 450; hp_h = 44
    draw.rounded_rectangle([hp_x, hp_y, hp_x+hp_w, hp_y+hp_h], radius=8, fill=BG3, outline=BORDER, width=1)
    # 見出し
    draw.text((hp_x+10, hp_y+4), '?', font=font(12), fill=TEXT2)
    draw.text((hp_x+22, hp_y+4), '画面操作', font=font(11), fill=TEXT2)
    draw.text((hp_x+hp_w-90, hp_y+4), '[クリックで開閉]', font=font(10), fill=TEXT3)
    # 2 行 x 2 列の内容
    line1a = 'パン'; val1a = 'Space + ドラッグ'
    line1b = 'ズーム'; val1b = 'ホイール／Ctrl + Space（右ドラッグ）'
    line2a = '回転'; val2a = 'Shift + Space'
    line2b = 'リセット'; val2b = '「等倍」ボタン'
    y1 = hp_y + 20; y2 = hp_y + 32
    def kv(x, y, k, v):
        draw.text((x, y), k, font=font(10), fill=TEXT2)
        kw = draw.textbbox((0,0), k, font=font(10))[2]
        draw.text((x+kw+6, y), v, font=font(10), fill=TEXT3)
    kv(hp_x+10,  y1, line1a, val1a)
    kv(hp_x+140, y1, line1b, val1b)
    kv(hp_x+10,  y2, line2a, val2a)
    kv(hp_x+140, y2, line2b, val2b)

    img.save('slides_assets/exr_anno_crypto.png', 'PNG', optimize=True)
    print('saved: slides_assets/exr_anno_crypto.png (%d x %d)' % (W, H))

if __name__ == '__main__':
    gen_anno_window_crypto()
