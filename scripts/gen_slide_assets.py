#!/usr/bin/env python3
"""Generate presentation assets:
1. slides_assets/exr_alllayers.png — 全レイヤーモーダル再現画像
2. slides_assets/r2_architecture.png — R2 運用構成図
"""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs('slides_assets', exist_ok=True)

FONT_JP = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
FONT_JP_P = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'

def font(size):
    return ImageFont.truetype(FONT_JP, size)
def font_p(size):
    return ImageFont.truetype(FONT_JP_P, size)

# ============================================================
# 共通シーン：3つの球体 + 床。各レイヤーで同じシーンを異なる表現で描く
# ============================================================
SPHERES = [
    (0.32, 0.62, 0.15, (220, 100, 90)),   # 赤玉
    (0.55, 0.58, 0.12, (110, 180, 220)),  # 青玉
    (0.75, 0.68, 0.10, (210, 200, 110)),  # 黄玉
]

def draw_scene(cw, ch, mode):
    """モードごとに 3 球体 + 床を描いた PIL Image を返す"""
    im = Image.new('RGB', (cw, ch), (10, 12, 18))
    d = ImageDraw.Draw(im)
    horizon = int(ch * 0.55)

    # --- 背景・床 ---
    if mode == 'beauty':
        # 空グラデ
        for y in range(horizon):
            t = y / horizon
            r, g, b = int(20+t*40), int(30+t*50), int(60+t*45)
            d.line([(0,y),(cw,y)], fill=(r,g,b))
        # 床グラデ
        for y in range(horizon, ch):
            t = (y-horizon)/(ch-horizon)
            g = int(70 + t*80)
            d.line([(0,y),(cw,y)], fill=(g, g-8, g-25))
    elif mode == 'depth':
        # 遠い=白、近い=黒（AE 準拠）
        for y in range(ch):
            if y < horizon:
                g = 250  # 空は「非常に遠い」= 白
            else:
                t = (y-horizon)/(ch-horizon)
                g = int(200 - t*180)  # 手前ほど暗く
            d.line([(0,y),(cw,y)], fill=(g,g,g))
    elif mode == 'normal':
        # 空・床とも中立の Normal 色（ワールド Y up 想定）
        for y in range(ch):
            if y < horizon:
                d.line([(0,y),(cw,y)], fill=(0,0,0))  # 空=非オブジェクト=黒
            else:
                # 床は上向き normal (0,1,0) → RGB (127,255,127)
                d.line([(0,y),(cw,y)], fill=(127, 240, 127))
    elif mode == 'albedo':
        # 平坦色のみ
        for y in range(horizon):
            d.line([(0,y),(cw,y)], fill=(35,45,60))
        for y in range(horizon,ch):
            d.line([(0,y),(cw,y)], fill=(120,110,90))
    elif mode == 'ao':
        # AO は白ベース、接触部が暗い
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(230,230,230))
    elif mode == 'diffuse_direct':
        for y in range(ch):
            if y<horizon: d.line([(0,y),(cw,y)], fill=(0,0,0))
            else:
                t=(y-horizon)/(ch-horizon); g=int(80+t*60)
                d.line([(0,y),(cw,y)], fill=(g, g-5, g-20))
    elif mode == 'specular':
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(0,0,0))
    elif mode == 'crypto':
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(0,0,0))
    elif mode == 'motion':
        # モーションベクター：全体うっすら、動く物体だけ強く
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(20,20,25))
    elif mode == 'position':
        # ワールド座標を bbox 正規化 → 上下 y、左右 x
        for y in range(ch):
            gy = int(255 * (1 - y/ch))  # 高い=白、低い=黒 (Y)
            for x in range(0, cw, 1):
                gx = int(255 * (x/cw))  # 右=白 (X)
                gz = int(180)
                # 実際は per-pixel だが線ごとに簡略化
            d.line([(0,y),(cw,y)], fill=(int(255*0.5), gy, 180))
        # 左右グラデを重ねる
        overlay = Image.new('RGB', (cw,ch), (0,0,0))
        od = ImageDraw.Draw(overlay)
        for x in range(cw):
            od.line([(x,0),(x,ch)], fill=(int(255*x/cw), 0, 0))
        im = Image.blend(im, overlay, 0.5)
        d = ImageDraw.Draw(im)
    elif mode == 'uv':
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(0,0,0))

    # --- 球体を描く ---
    for idx,(nx, ny, nr, color) in enumerate(SPHERES):
        cx, cy, r = nx*cw, ny*ch, nr*min(cw,ch)
        for py in range(max(0,int(cy-r)), min(ch,int(cy+r+1))):
            for px in range(max(0,int(cx-r)), min(cw,int(cx+r+1))):
                dx, dy = px-cx, py-cy
                d2 = dx*dx + dy*dy
                if d2 > r*r: continue
                z = math.sqrt(max(0.0, r*r - d2)) / r  # 表面法線 z 成分
                nx_ = dx/r; ny_ = dy/r
                if mode == 'beauty':
                    # ランバート＋ハイライト
                    ldx, ldy, ldz = -0.4, -0.5, 0.75
                    ndot = max(0, nx_*ldx + ny_*ldy + z*ldz)
                    lit = 0.25 + 0.75*ndot
                    r_,g_,b_ = color
                    r_ = min(255,int(r_*lit + 40*(ndot**8)))
                    g_ = min(255,int(g_*lit + 40*(ndot**8)))
                    b_ = min(255,int(b_*lit + 40*(ndot**8)))
                    im.putpixel((px,py), (r_,g_,b_))
                elif mode == 'depth':
                    # 球体は手前ほど暗く（AE 準拠：近い=黒、遠い=白）
                    # 各球体の位置＋z成分で疑似 depth
                    layer_depth = 0.35 + idx*0.15  # 手前=低い値=黒
                    depth_val = layer_depth - z*0.05
                    g = int(max(0,min(255, depth_val*255)))
                    im.putpixel((px,py), (g,g,g))
                elif mode == 'normal':
                    # ワールド Normal を RGB に：(x,y,z) → ((x+1)/2, (-y+1)/2, (z+1)/2)
                    r_ = int((nx_*0.5+0.5)*255)
                    g_ = int((-ny_*0.5+0.5)*255)  # 画面 y と ワールド y は反転
                    b_ = int((z*0.5+0.5)*255)
                    im.putpixel((px,py), (r_, g_, b_))
                elif mode == 'albedo':
                    # 平坦色（シェーディングなし）
                    im.putpixel((px,py), color)
                elif mode == 'ao':
                    # 縁で暗くなる
                    edge = z**0.6
                    g = int(80 + 175*edge)
                    im.putpixel((px,py), (g,g,g))
                elif mode == 'diffuse_direct':
                    ldx, ldy, ldz = -0.4, -0.5, 0.75
                    ndot = max(0, nx_*ldx + ny_*ldy + z*ldz)
                    lit = 0.15 + 0.75*ndot
                    r_ = min(255, int(color[0]*lit*0.85))
                    g_ = min(255, int(color[1]*lit*0.85))
                    b_ = min(255, int(color[2]*lit*0.85))
                    im.putpixel((px,py), (r_,g_,b_))
                elif mode == 'specular':
                    ldx, ldy, ldz = -0.4, -0.5, 0.75
                    ndot = max(0, nx_*ldx + ny_*ldy + z*ldz)
                    spec = ndot**32
                    g = int(spec*255)
                    im.putpixel((px,py), (g,g,g))
                elif mode == 'crypto':
                    # 各球体固定のハッシュ色（明るめランダム）
                    ccols = [(240,120,90), (100,220,180), (180,120,240)]
                    im.putpixel((px,py), ccols[idx])
                elif mode == 'motion':
                    # 中央球のみ動く想定：HSV で表現（色相=角度、彩度=強度）
                    if idx == 1:
                        # 動いてる → 明るい水色系
                        im.putpixel((px,py), (110, 200, 240))
                    else:
                        im.putpixel((px,py), (30,30,40))
                elif mode == 'position':
                    # 位置に応じて色化：世界座標 x,y,z を各 RGB に
                    r_ = int((px/cw)*255)
                    g_ = int((1-py/ch)*255)
                    b_ = int((z*0.5+0.5)*180)
                    im.putpixel((px,py), (r_,g_,b_))
                elif mode == 'uv':
                    # UV：球体は疑似的に緯度経度 → R, G
                    u = math.atan2(nx_, z if z>0 else 0.001)/math.pi*0.5 + 0.5
                    v = ny_*0.5+0.5
                    im.putpixel((px,py), (int(u*255), int(v*255), 0))
        # AO の床との接触暗さ（軽く楕円）
        if mode == 'ao':
            od = ImageDraw.Draw(im)
            for i in range(3):
                al = 60-i*15
                od.ellipse([cx-r*1.2+i, cy+r*0.7-i//2, cx+r*1.2-i, cy+r*0.9+i//2],
                          fill=(120+i*30,120+i*30,120+i*30))
    return im

# ============================================================
# EXR 全レイヤーモーダル画像
# ============================================================
def gen_exr_alllayers():
    W, H = 1600, 1050
    BG = (13,13,15)
    CARD = (28,28,34)
    BORDER = (45,45,52)
    TEXT = (242,243,247)
    TEXT2 = (154,154,170)
    ACC = (165, 107, 240)

    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ヘッダ
    draw.rectangle([0, 0, W, 80], fill=(22,22,28))
    draw.line([(0,80), (W,80)], fill=BORDER, width=1)
    draw.text((40, 24), '🎨 EXR 全レイヤー', font=font(28), fill=TEXT)
    draw.text((40, 55), 'ANM_EP03_C010_V004_0976  ／  解像度: 1920×1080  ／  レイヤー: 12 件（クリックでそのレイヤーを開く）',
              font=font(14), fill=TEXT2)
    # 閉じるボタン
    draw.text((W-60, 24), '×', font=font(36), fill=TEXT2)

    # タイルグリッド
    cols, rows = 4, 3
    tile_w, tile_h = 340, 300
    prev_h = 200
    gap = 18
    total_w = cols*tile_w + (cols-1)*gap
    grid_x = (W - total_w) // 2
    grid_y = 110

    layers = [
        ('beauty',        'beauty',        '(RGBAZ)',  'beauty'),
        ('albedo',        'albedo',        '(RGB)',    'albedo'),
        ('AO',            'ao',            '(RGBA)',   'AO'),
        ('diffuse_direct','diffuse_direct','(RGB)',    'diffuse_direct'),
        ('specular',      'specular',      '(RGB)',    'specular'),
        ('N',             'normal',        '(XYZ)',    'N'),
        ('Z (Depth)',     'depth',         '(Z)',      'Z (Depth)'),
        ('P (Position)',  'position',      '(XYZ)',    'P (Position)'),
        ('UV',            'uv',            '(UV)',     'UV'),
        ('motion_vector', 'motion',        '(XY)',     'motion_vector'),
        ('crypto_object', 'crypto',        '(RGB)',    'crypto_object'),
        ('crypto_asset',  'crypto',        '(RGB)',    'crypto_asset'),
    ]

    for i, (name, mode, ch, disp) in enumerate(layers):
        col = i % cols; row = i // cols
        x = grid_x + col*(tile_w+gap); y = grid_y + row*(tile_h+gap)
        # タイル背景
        draw.rectangle([x, y, x+tile_w, y+tile_h], fill=CARD, outline=BORDER, width=1)
        # プレビュー
        prev = draw_scene(tile_w, prev_h, mode)
        img.paste(prev, (x, y))
        # 下のキャプション枠
        draw.line([(x, y+prev_h), (x+tile_w, y+prev_h)], fill=BORDER, width=1)
        # レイヤー名
        draw.text((x+14, y+prev_h+14), disp, font=font(20), fill=TEXT)
        # チャンネル情報
        draw.text((x+14, y+prev_h+45), ch, font=font(14), fill=TEXT2)
        # 描画モードラベル
        mode_label = {
            'beauty':'RGB カラー', 'albedo':'RGB カラー',
            'ao':'アルファ (単色)', 'diffuse_direct':'RGB カラー',
            'specular':'RGB カラー', 'normal':'Normal (XYZ)',
            'depth':'Depth (Z)', 'position':'Position',
            'uv':'UV パス', 'motion':'Motion Vector',
            'crypto':'Cryptomatte',
        }[mode]
        # モードラベルを右下に淡く
        bbox = draw.textbbox((0,0), mode_label, font=font(12))
        tw = bbox[2]-bbox[0]
        draw.rounded_rectangle([x+tile_w-tw-24, y+prev_h+16, x+tile_w-8, y+prev_h+40],
                              radius=4, fill=(50,50,60))
        draw.text((x+tile_w-tw-16, y+prev_h+20), mode_label, font=font(12), fill=(200,180,240))

    img.save('slides_assets/exr_alllayers.png', 'PNG', optimize=True)
    print('saved: slides_assets/exr_alllayers.png (%d x %d)' % (W, H))

# ============================================================
# R2 運用構成図
# ============================================================
def gen_r2_diagram():
    W, H = 1600, 900
    BG=(13,13,15); CARD=(30,30,38); CARD_HL=(40,40,52); BORDER=(75,75,90)
    TEXT=(242,243,247); TEXT2=(190,190,210); ACC=(165,107,240)
    CLOUD=(90,155,255); OK=(100,210,140); GRAY=(150,150,170)
    ORANGE=(243,130,30)
    img = Image.new('RGB',(W,H),BG); draw = ImageDraw.Draw(img)

    # タイトル
    draw.text((60, 34), 'クラウドストレージ対応', font=font(34), fill=TEXT)
    draw.text((60, 82), 'ブラウザ → 受付係（Worker） → 保管庫（バケット）の 3 段構造で、安全に共有します',
              font=font(16), fill=TEXT2)

    # 3 段横並び
    box_y = 170
    box_h = 400
    b1_x, b1_w = 60,  380  # ユーザー
    b2_x, b2_w = 610, 380  # Worker
    b3_x, b3_w = 1160, 380 # バケット

    # ---- ① ユーザー（ブラウザ） ----
    draw.rounded_rectangle([b1_x, box_y, b1_x+b1_w, box_y+box_h], radius=14, fill=CARD, outline=BORDER, width=2)
    draw.text((b1_x+20, box_y+18), '👤 チームメンバー', font=font(22), fill=TEXT)
    draw.text((b1_x+20, box_y+54), 'ブラウザで LayCAT を開くだけ', font=font(14), fill=TEXT2)
    persons = [('会社の PC から', OK), ('在宅で', OK), ('出張先で', OK)]
    for i,(lab,col) in enumerate(persons):
        py = box_y + 105 + i*95
        draw.ellipse([b1_x+40, py, b1_x+80, py+40], fill=col)
        draw.rounded_rectangle([b1_x+30, py+40, b1_x+90, py+80], radius=10, fill=col)
        draw.text((b1_x+110, py+18), lab, font=font(18), fill=TEXT)
        draw.text((b1_x+110, py+46), '同じプロジェクトを開ける', font=font(13), fill=TEXT2)

    # ---- ② Worker（受付係） ----
    draw.rounded_rectangle([b2_x, box_y, b2_x+b2_w, box_y+box_h], radius=14, fill=CARD, outline=ORANGE, width=3)
    draw.text((b2_x+20, box_y+18), '🚪 Worker（受付係）', font=font(22), fill=ORANGE)
    draw.text((b2_x+20, box_y+54), 'Cloudflare 上の小さなプログラム', font=font(14), fill=TEXT2)
    roles = [
        ('👥', '本人確認',           'ログイン中のユーザーかどうか'),
        ('🔑', 'メンバーチェック',    'そのプロジェクトの招待メンバーか'),
        ('📏', 'ファイル検査・記録',  'サイズ制限とアクセス履歴の記録'),
    ]
    for i,(ic,t,d) in enumerate(roles):
        ry = box_y + 105 + i*95
        draw.rounded_rectangle([b2_x+15, ry, b2_x+b2_w-15, ry+85], radius=8, fill=CARD_HL, outline=BORDER, width=1)
        draw.text((b2_x+28, ry+24), ic, font=font(28), fill=ORANGE)
        draw.text((b2_x+80, ry+18), t, font=font(17), fill=TEXT)
        draw.text((b2_x+80, ry+48), d, font=font(13), fill=TEXT2)

    # ---- ③ バケット（保管庫） ----
    draw.rounded_rectangle([b3_x, box_y, b3_x+b3_w, box_y+box_h], radius=14, fill=CARD, outline=CLOUD, width=2)
    draw.text((b3_x+20, box_y+18), '🪣 バケット（保管庫）', font=font(22), fill=CLOUD)
    draw.text((b3_x+20, box_y+54), 'Cloudflare R2（クラウドストレージ）', font=font(14), fill=TEXT2)
    projects = [
        ('プロジェクト A', 'アニメ第 1 話'),
        ('プロジェクト B', '短編 CG'),
        ('プロジェクト C', 'PV 制作'),
    ]
    for i,(pn,pd) in enumerate(projects):
        py = box_y + 105 + i*95
        draw.rounded_rectangle([b3_x+15, py, b3_x+b3_w-15, py+85], radius=8, fill=CARD_HL, outline=BORDER, width=1)
        draw.text((b3_x+28, py+24), '🔒', font=font(28), fill=OK)
        draw.text((b3_x+80, py+15), pn, font=font(17), fill=TEXT)
        draw.text((b3_x+80, py+40), pd, font=font(13), fill=TEXT2)
        draw.text((b3_x+80, py+60), '動画・EXR・コメント履歴', font=font(11), fill=(140,140,160))

    # ---- 矢印 ----
    arr_y = box_y + box_h//2
    draw.line([(b1_x+b1_w+5, arr_y),(b2_x-5, arr_y)], fill=ORANGE, width=4)
    draw.polygon([(b2_x-5, arr_y),(b2_x-20, arr_y-10),(b2_x-20, arr_y+10)], fill=ORANGE)
    draw.text((b1_x+b1_w+30, arr_y-42), 'アクセス要求', font=font(13), fill=TEXT2)
    draw.line([(b2_x+b2_w+5, arr_y),(b3_x-5, arr_y)], fill=OK, width=4)
    draw.polygon([(b3_x-5, arr_y),(b3_x-20, arr_y-10),(b3_x-20, arr_y+10)], fill=OK)
    draw.text((b2_x+b2_w+30, arr_y-42), '許可 OK → 実行', font=font(13), fill=TEXT2)

    # ---- 下部：メリット（4 カード） ----
    footer_y = 620
    draw.line([(60, footer_y),(W-60, footer_y)], fill=BORDER, width=1)
    benefits = [
        ('🌏', 'どこからでも見られる',    '会社・自宅・出先どこでも、\n同じデータをブラウザで開ける'),
        ('🔒', '決まった人だけがアクセス', '招待されたメンバー以外は\n受付係で自動的に拒否'),
        ('📊', '安全に保管・追跡可能',    'ファイルサイズ制限＋\n全アクセスの記録が残る'),
        ('🔄', 'フォルダ運用と併用',      'プロジェクト単位で\nクラウド／フォルダを選べる'),
    ]
    card_w = (W - 120 - 60) // 4
    card_h = 210
    for i,(ic, t, d) in enumerate(benefits):
        bx = 60 + i*(card_w + 20)
        by = footer_y + 30
        draw.rounded_rectangle([bx, by, bx+card_w, by+card_h], radius=14, fill=CARD, outline=BORDER, width=1)
        draw.text((bx+20, by+16), ic, font=font(34), fill=ACC)
        draw.text((bx+20, by+64), t, font=font(17), fill=TEXT)
        # 2 行説明
        for j, line in enumerate(d.split('\n')):
            draw.text((bx+20, by+104+j*24), line, font=font(13), fill=TEXT2)

    img.save('slides_assets/r2_architecture.png', 'PNG', optimize=True)
    print('saved: slides_assets/r2_architecture.png (%d x %d)' % (W, H))

if __name__ == '__main__':
    gen_exr_alllayers()
    gen_r2_diagram()
