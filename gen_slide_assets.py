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
    BG = (13,13,15)
    CARD = (28,28,34)
    CARD_HL = (36,36,46)
    BORDER = (60,60,70)
    TEXT = (242,243,247)
    TEXT2 = (154,154,170)
    ACC = (165, 107, 240)     # LayCAT purple
    OK = (100, 200, 130)
    WARN = (240, 170, 80)
    ERR = (240, 100, 100)
    CF_ORANGE = (243, 130, 30)  # Cloudflare orange
    FB_YELLOW = (255, 202, 40)  # Firebase yellow
    BLUE = (90, 155, 255)

    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # タイトル
    draw.text((60, 30), 'LayCAT × Cloudflare R2 運用構成', font=font(30), fill=TEXT)
    draw.text((60, 72), 'ブラウザ（LayCAT） ⇄ Cloudflare Worker（認可） ⇄ R2 バケット（データ保存）',
              font=font(15), fill=TEXT2)

    # 各ノードを配置
    # ユーザーブラウザ（左）
    ux, uy, uw, uh = 60, 180, 340, 400
    draw.rounded_rectangle([ux, uy, ux+uw, uy+uh], radius=14, fill=CARD, outline=BORDER, width=2)
    draw.text((ux+20, uy+18), '👤 ユーザーのブラウザ', font=font(20), fill=TEXT)
    draw.text((ux+20, uy+50), 'LayCAT（laycat.html）', font=font(14), fill=ACC)
    # 中に Firebase Login
    fbx, fby = ux+20, uy+95
    draw.rounded_rectangle([fbx, fby, fbx+300, fby+70], radius=8, fill=CARD_HL, outline=BORDER, width=1)
    draw.text((fbx+15, fby+10), '🔐 Firebase Login', font=font(15), fill=FB_YELLOW)
    draw.text((fbx+15, fby+35), 'Google アカウントでサインイン →', font=font(12), fill=TEXT2)
    draw.text((fbx+15, fby+52), '  ID トークンを取得（毎リクエストに添付）', font=font(12), fill=TEXT2)
    # R2 保存操作
    ox, oy = ux+20, uy+195
    draw.rounded_rectangle([ox, oy, ox+300, oy+70], radius=8, fill=CARD_HL, outline=BORDER, width=1)
    draw.text((ox+15, oy+10), '💾 プロジェクト保存', font=font(15), fill=BLUE)
    draw.text((ox+15, oy+35), 'PUT / GET / LIST を', font=font(12), fill=TEXT2)
    draw.text((ox+15, oy+52), '  Worker 経由で実行', font=font(12), fill=TEXT2)
    # 招待
    ix, iy = ux+20, uy+295
    draw.rounded_rectangle([ix, iy, ix+300, iy+70], radius=8, fill=CARD_HL, outline=BORDER, width=1)
    draw.text((ix+15, iy+10), '🤝 プロジェクト共有', font=font(15), fill=OK)
    draw.text((ix+15, iy+35), 'プロジェクト ID を渡すだけで', font=font(12), fill=TEXT2)
    draw.text((ix+15, iy+52), '  他ユーザーが即接続可能', font=font(12), fill=TEXT2)

    # Cloudflare Worker（中央）
    wx, wy, ww, wh = 550, 180, 500, 500
    draw.rounded_rectangle([wx, wy, wx+ww, wy+wh], radius=14, fill=CARD, outline=CF_ORANGE, width=3)
    draw.text((wx+20, wy+18), '⚡ Cloudflare Worker', font=font(22), fill=CF_ORANGE)
    draw.text((wx+20, wy+50), '認可・サイズ制限・監査ログを担当', font=font(14), fill=TEXT2)

    # Worker 内の処理
    for i, (title, desc, color) in enumerate([
        ('① ID トークン検証', 'Firebase 公開鍵で本人性を確認', FB_YELLOW),
        ('② アクセス制御 (ACL)', '_access.json を読み owner/members を判定', ACC),
        ('③ ファイルサイズ検査', 'JSON 10MB / メディア 500MB / 絶対 2GB 上限', WARN),
        ('④ 監査ログ記録', '全リクエストを Cloudflare Workers Logs に記録', BLUE),
        ('⑤ R2 に転送', '許可された操作のみ R2 バケットへ実行', OK),
    ]):
        sy = wy+95+i*76
        draw.rounded_rectangle([wx+20, sy, wx+ww-20, sy+64], radius=8, fill=CARD_HL, outline=BORDER, width=1)
        draw.text((wx+35, sy+10), title, font=font(15), fill=color)
        draw.text((wx+35, sy+36), desc, font=font(12), fill=TEXT2)

    # R2 バケット（右）
    rx, ry, rw, rh = 1200, 180, 340, 500
    draw.rounded_rectangle([rx, ry, rx+rw, ry+rh], radius=14, fill=CARD, outline=BORDER, width=2)
    draw.text((rx+20, ry+18), '🪣 Cloudflare R2', font=font(20), fill=CF_ORANGE)
    draw.text((rx+20, ry+50), 'S3 互換オブジェクトストレージ', font=font(13), fill=TEXT2)

    # バケット構造
    draw.text((rx+20, ry+90), 'projects/', font=font(13), fill=TEXT2)
    # プロジェクト 1
    p1y = ry+118
    draw.rounded_rectangle([rx+30, p1y, rx+rw-20, p1y+120], radius=8, fill=CARD_HL, outline=BORDER, width=1)
    draw.text((rx+45, p1y+10), '📁 project_abc123/', font=font(14), fill=ACC)
    draw.text((rx+50, p1y+35), '🔒 _access.json (owner + members)', font=font(11), fill=OK)
    draw.text((rx+50, p1y+55), '📄 laycat.project.json', font=font(11), fill=TEXT2)
    draw.text((rx+50, p1y+75), '📁 media/ (動画・画像・EXR)', font=font(11), fill=TEXT2)
    draw.text((rx+50, p1y+95), '📁 reels/ (リール定義)', font=font(11), fill=TEXT2)
    # プロジェクト 2
    p2y = p1y+140
    draw.rounded_rectangle([rx+30, p2y, rx+rw-20, p2y+120], radius=8, fill=CARD_HL, outline=BORDER, width=1)
    draw.text((rx+45, p2y+10), '📁 project_xyz789/', font=font(14), fill=ACC)
    draw.text((rx+50, p2y+35), '🔒 _access.json', font=font(11), fill=OK)
    draw.text((rx+50, p2y+55), '📄 laycat.project.json', font=font(11), fill=TEXT2)
    draw.text((rx+50, p2y+75), '📁 media/', font=font(11), fill=TEXT2)
    draw.text((rx+50, p2y+95), '📁 reels/', font=font(11), fill=TEXT2)
    # 「他社は絶対アクセス不可」の注記
    draw.text((rx+20, ry+rh-40), '各プロジェクトは _access.json で完全隔離。', font=font(11), fill=TEXT2)
    draw.text((rx+20, ry+rh-22), '所属メンバー以外は Worker で 403 返却。', font=font(11), fill=TEXT2)

    # 矢印：ブラウザ → Worker
    ax1, ay1 = ux+uw, uy+230
    ax2, ay2 = wx, wy+230
    draw.line([(ax1, ay1),(ax2, ay2)], fill=ACC, width=3)
    # 矢頭
    draw.polygon([(ax2, ay2),(ax2-14, ay2-8),(ax2-14, ay2+8)], fill=ACC)
    draw.text(((ax1+ax2)/2-70, ay1-24), '① fetch + IDトークン', font=font(12), fill=ACC)

    # 矢印：Worker → R2
    bx1, by1 = wx+ww, wy+230
    bx2, by2 = rx, ry+230
    draw.line([(bx1, by1),(bx2, by2)], fill=OK, width=3)
    draw.polygon([(bx2, by2),(bx2-14, by2-8),(bx2-14, by2+8)], fill=OK)
    draw.text(((bx1+bx2)/2-70, by1-24), '⑤ 認可 OK → 実行', font=font(12), fill=OK)

    # 反矢印（レスポンス）
    ax1r, ay1r = wx, wy+310
    ax2r, ay2r = ux+uw, uy+310
    draw.line([(ax1r, ay1r),(ax2r, ay2r)], fill=TEXT2, width=2)
    draw.polygon([(ax2r, ay2r),(ax2r+12, ay2r-7),(ax2r+12, ay2r+7)], fill=TEXT2)
    draw.text(((ax1r+ax2r)/2-40, ay2r+5), 'レスポンス（データ or 403）', font=font(11), fill=TEXT2)

    # 下部：メリット箇条書き
    footer_y = 720
    draw.line([(60, footer_y), (W-60, footer_y)], fill=BORDER, width=1)
    draw.text((60, footer_y+20), '💡 この構成のメリット', font=font(18), fill=TEXT)
    benefits = [
        ('🔒 メンバー方式アクセス制御',   '所属していないユーザーは 403。他社データが混ざる事故を防止。'),
        ('🌏 場所を選ばないアクセス',      'クラウドなので、社外・在宅・出張先からもブラウザだけで利用可能。'),
        ('📏 サイズ上限＋監査ログ',      '悪意ある無料枠枯渇・追跡不能な操作を防ぐ Worker レイヤー。'),
        ('🔄 従来のフォルダ運用と併用',   'R2 移行はプロジェクト単位。既存の運用はそのまま。'),
    ]
    for i, (t, d) in enumerate(benefits):
        col = i % 2; row = i // 2
        bx = 60 + col*760; by = footer_y+55 + row*55
        draw.text((bx, by), t, font=font(15), fill=ACC)
        draw.text((bx+280, by+2), d, font=font(13), fill=TEXT2)

    img.save('slides_assets/r2_architecture.png', 'PNG', optimize=True)
    print('saved: slides_assets/r2_architecture.png (%d x %d)' % (W, H))

if __name__ == '__main__':
    gen_exr_alllayers()
    gen_r2_diagram()
