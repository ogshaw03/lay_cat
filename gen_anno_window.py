#!/usr/bin/env python3
"""アノテウィンドウで Cryptomatte レイヤーを表示中の再現画像
色は laycat.html の CSS 変数と一致させる：
  --bg=#0d0d0f, --bg2=#141416, --bg3=#1c1c1f, --bg4=#232327
  --border=#2a2a2f, --border2=#3a3a42
  --text=#e8e8ec, --text2=#9a9aaa, --text3=#5a5a6a
  active btn: #ececf0 background, #16161a text
  edge (focus): rgba(96,165,255,0.7)
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
    BG      = (13, 13, 15)      # --bg
    BG2     = (20, 20, 22)      # --bg2 (fb-top, fb-controls 背景)
    BG3     = (28, 28, 31)      # --bg3 (select, ghost の入力)
    BG4     = (35, 35, 39)      # --bg4
    BORDER  = (42, 42, 47)      # --border
    BORDER2 = (58, 58, 66)      # --border2
    TEXT    = (232, 232, 236)   # --text
    TEXT2   = (154, 154, 170)   # --text2
    TEXT3   = (90, 90, 106)     # --text3
    ACTIVE_BG = (236, 236, 240) # 白 (active btn / primary)
    ACTIVE_FG = (22, 22, 26)    # 濃紺（active btn の文字）
    EDGE_BLUE = (96, 165, 255)  # 青いエッジ（focus/選択）
    DANGER    = (232, 100, 100) # 削除ボタンなど

    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # === トップバー（fb-top）===
    top_h = 56
    draw.rectangle([0, 0, W, top_h], fill=BG2)
    # ボトムラインは青エッジ（fb-top のフォーカス風）
    draw.rectangle([0, top_h-1, W, top_h+1], fill=EDGE_BLUE)

    def btn_ghost(x, y, w, h, label, fg=TEXT2, radius=8, active=False):
        if active:
            draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=ACTIVE_BG)
            draw.text((x+12, y+ (h-14)//2), label, font=font(13), fill=ACTIVE_FG)
        else:
            draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, outline=BORDER, width=1)
            draw.text((x+12, y+(h-14)//2), label, font=font(13), fill=fg)

    x = 16
    # ノード名 - バージョン名（fb-title）
    draw.text((x, 18), 'anm/cut_010 — v004', font=font(16), fill=TEXT)
    tw = draw.textbbox((0,0), 'anm/cut_010 — v004', font=font(16))[2]
    x += tw + 16
    # ステータスバッジ（badge, hexA color 18% + green text）
    st_bg = (30, 74, 44)  # 半透明 OK 色相当
    st_txt = (100, 210, 140)
    draw.rounded_rectangle([x, 16, x+96, 40], radius=6, fill=st_bg)
    draw.text((x+10, 20), 'チェック待ち', font=font(12), fill=st_txt)
    x += 116
    # by / date
    draw.text((x, 20), 'by 小倉正太・2026/07/21', font=font(12), fill=TEXT2)
    x += 220
    # ステータス切替 select (.status-sel)
    draw.rounded_rectangle([x, 14, x+140, 42], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((x+12, 20), 'チェック待ち  ▾', font=font(13), fill=TEXT)
    x += 156
    # 📼 レイヤー select
    draw.rounded_rectangle([x, 14, x+210, 42], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((x+12, 20), '📼 crypto_object  ▾', font=font(13), fill=TEXT)
    x += 226
    # 露出 mini-slider（.fb-mini-slider：背景 bg3、内側にラベル・range・数値）
    def mini_slider(xx, label, val, w=138):
        draw.rounded_rectangle([xx, 18, xx+w, 40], radius=6, fill=BG3, outline=BORDER, width=1)
        draw.text((xx+8, 24), label, font=font(11), fill=TEXT2)
        lbw = draw.textbbox((0,0), label, font=font(11))[2]
        # range bar
        bar_x = xx+8+lbw+6; bar_y = 29
        bar_w = w - (bar_x-xx) - 44
        draw.rectangle([bar_x, bar_y, bar_x+bar_w, bar_y+1], fill=BORDER2)
        # つまみ（真ん中）
        kx = bar_x + int(bar_w*0.5)
        draw.rectangle([kx-2, bar_y-6, kx+2, bar_y+6], fill=TEXT2)
        # 数値
        draw.text((xx+w-40, 23), val, font=font(11), fill=TEXT)
    mini_slider(x, '露出', '0.0', w=130); x += 138
    mini_slider(x, 'ガンマ', '2.20', w=138); x += 146
    # リセットボタン ↺
    btn_ghost(x, 14, 34, 28, '↺', fg=TEXT2, radius=6); x += 42
    # 🖼 サムネ更新
    btn_ghost(x, 14, 130, 28, '🖼 サムネ更新', fg=TEXT2, radius=6)
    # 右端：削除・全画面
    x = W - 96
    draw.rounded_rectangle([x, 14, x+34, 42], radius=6, fill=(50, 20, 22))
    draw.text((x+10, 20), '🗑', font=font(14), fill=DANGER)
    x += 42
    btn_ghost(x, 14, 34, 28, '⛶', fg=TEXT2, radius=6)

    # === ツールバー（fb-controls）===
    tb_y = top_h + 4
    tb_h = 44
    draw.rectangle([0, tb_y, W, tb_y+tb_h], fill=BG2)
    draw.line([(0, tb_y+tb_h), (W, tb_y+tb_h)], fill=BORDER, width=1)
    tx = 14
    # ペンボタン（アクティブ = 白背景）
    btn_ghost(tx, tb_y+8, 90, 28, '✎ 描画', active=True, radius=6); tx += 100
    # サイズ select
    draw.rounded_rectangle([tx, tb_y+8, tx+96, tb_y+36], radius=6, fill=BG3, outline=BORDER, width=1)
    draw.text((tx+10, tb_y+14), 'ブラシ 6 ▾', font=font(13), fill=TEXT); tx += 106
    # 筆圧
    btn_ghost(tx, tb_y+8, 78, 28, '✒ 筆圧', radius=6); tx += 88
    # 顔ガイド
    btn_ghost(tx, tb_y+8, 108, 28, '◑ 顔の向き', radius=6); tx += 118
    # カラーパレット
    colors_hex = ['#ff4d4d','#ff9f2e','#ffe34d','#4dff88','#4da6ff','#ffffff','#111111']
    for c in colors_hex:
        h_,s_,v_ = int(c[1:3],16), int(c[3:5],16), int(c[5:7],16)
        # 選択中（赤）は青い枠
        sel = (c == '#ff4d4d')
        draw.rounded_rectangle([tx, tb_y+11, tx+22, tb_y+33], radius=4, fill=(h_,s_,v_),
                              outline=EDGE_BLUE if sel else BORDER, width=2 if sel else 1)
        tx += 26
    tx += 10
    # ゴースト
    btn_ghost(tx, tb_y+8, 86, 28, 'ゴースト', radius=6); tx += 96
    # 👁 表示（アクティブ）
    btn_ghost(tx, tb_y+8, 46, 28, '👁', active=True, radius=6); tx += 56
    # トレペ 0%
    btn_ghost(tx, tb_y+8, 90, 28, 'トレペ 0%', radius=6); tx += 100
    # レイヤー
    btn_ghost(tx, tb_y+8, 96, 28, '▤ レイヤー', radius=6); tx += 106
    # Undo / Redo / クリア
    btn_ghost(tx, tb_y+8, 34, 28, '↩', radius=6); tx += 42
    btn_ghost(tx, tb_y+8, 34, 28, '↪', radius=6); tx += 42
    btn_ghost(tx, tb_y+8, 66, 28, 'クリア', radius=6)

    # === メインエリア ===
    main_y = tb_y + tb_h + 2
    right_w = 320
    ctr_h = 52  # 下部プレイヤーコントロール高
    canvas_y = main_y
    canvas_x = 0
    canvas_w = W - right_w
    canvas_h = H - main_y - ctr_h

    draw.rectangle([canvas_x, canvas_y, canvas_x+canvas_w, canvas_y+canvas_h], fill=(0,0,0))
    # 画像（Cryptomatte）
    img_ratio = 1920/1080
    max_iw = canvas_w - 60
    max_ih = canvas_h - 60
    iw = min(max_iw, int(max_ih*img_ratio))
    ih = int(iw/img_ratio)
    if ih > max_ih:
        ih = max_ih; iw = int(ih*img_ratio)
    ix = canvas_x + (canvas_w - iw)//2
    iy = canvas_y + (canvas_h - ih)//2
    crypto_img = draw_crypto_scene(iw, ih)
    img.paste(crypto_img, (ix, iy))
    draw.rectangle([ix-1, iy-1, ix+iw+1, iy+ih+1], outline=BORDER, width=1)

    # === 右パネル（コメント）===
    rx = W - right_w
    draw.rectangle([rx, main_y, W, H], fill=BG2)
    draw.line([(rx, main_y), (rx, H)], fill=BORDER, width=1)
    draw.text((rx+16, main_y+16), 'コメント', font=font(15), fill=TEXT)
    draw.line([(rx+12, main_y+46), (W-12, main_y+46)], fill=BORDER, width=1)

    def comment(y, name, time, text, has_shot=False):
        ch_h = 108 if has_shot else 66
        draw.rounded_rectangle([rx+12, y, W-12, y+ch_h], radius=8, fill=BG3, outline=BORDER, width=1)
        draw.text((rx+22, y+8), name, font=font(12), fill=TEXT)
        nw = draw.textbbox((0,0), name, font=font(12))[2]
        draw.text((rx+22+nw+6, y+9), '・'+time, font=font(11), fill=TEXT3)
        # 内容
        draw.text((rx+22, y+30), text, font=font(12), fill=TEXT2)
        if has_shot:
            mini = draw_crypto_scene(78, 44)
            img.paste(mini, (rx+22, y+56))
            draw.rectangle([rx+21, y+55, rx+100, y+100], outline=BORDER, width=1)

    comment(main_y+60, '小倉正太', '2026/07/21', '青い車のマスクを別レイヤーで抽出お願いします', True)
    comment(main_y+184, 'ディレクター', '2026/07/21', 'クリプトで確認しました、OK です', False)

    # 入力欄
    inp_y = H - 118
    draw.rounded_rectangle([rx+12, inp_y, W-12, inp_y+96], radius=8, fill=BG3, outline=BORDER, width=1)
    draw.text((rx+22, inp_y+12), 'コメント…（@メンション・Ctrl+Enter で送信）', font=font(12), fill=TEXT3)
    # 送信ボタン（白 primary）
    draw.rounded_rectangle([W-92, inp_y+58, W-22, inp_y+86], radius=6, fill=ACTIVE_BG)
    draw.text((W-72, inp_y+64), '送信', font=font(13), fill=ACTIVE_FG)

    # === 下部：プレイヤーコントロール（fb-controls 下段：ズーム等）===
    ctr_y = canvas_y + canvas_h
    draw.rectangle([0, ctr_y, W-right_w, H], fill=BG2)
    draw.line([(0, ctr_y), (W-right_w, ctr_y)], fill=BORDER, width=1)
    cx = 14
    for lbl in ['🔍+', '🔍−']:
        btn_ghost(cx, ctr_y+10, 40, 32, lbl, radius=6); cx += 50
    draw.text((cx, ctr_y+18), '100%', font=font(13), fill=TEXT); cx += 60
    btn_ghost(cx, ctr_y+10, 56, 32, '等倍', radius=6); cx += 66
    btn_ghost(cx, ctr_y+10, 108, 32, '✋ トラック', radius=6); cx += 118
    btn_ghost(cx, ctr_y+10, 78, 32, '⇋ 反転', radius=6); cx += 88

    # ヒント（右寄り・fb-help 相当）
    hint_x = W - right_w - 340
    draw.text((hint_x, ctr_y+10), 'Space+ドラッグ: パン ／ Shift+Space: 回転', font=font(11), fill=TEXT3)
    draw.text((hint_x, ctr_y+26), 'Ctrl+Space: ズーム ／ Alt+右: ブラシサイズ', font=font(11), fill=TEXT3)

    img.save('slides_assets/exr_anno_crypto.png', 'PNG', optimize=True)
    print('saved: slides_assets/exr_anno_crypto.png (%d x %d)' % (W, H))

if __name__ == '__main__':
    gen_anno_window_crypto()
