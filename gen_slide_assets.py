#!/usr/bin/env python3
"""Generate presentation assets (non-technical audience version):
1. slides_assets/exr_alllayers.png — EXR 全レイヤータイル画像（日本語ラベル）
2. slides_assets/r2_architecture.png — R2 クラウド運用のシンプル構成図
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

os.makedirs('slides_assets', exist_ok=True)

FONT_JP = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
FONT_JP_P = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
def font(size): return ImageFont.truetype(FONT_JP, size)
def font_p(size): return ImageFont.truetype(FONT_JP_P, size)

# 共通シーン（3球体＋床）— 各レイヤーで同じシーンを異なる表現で描く
SPHERES = [
    (0.32, 0.62, 0.15, (220, 100, 90)),
    (0.55, 0.58, 0.12, (110, 180, 220)),
    (0.75, 0.68, 0.10, (210, 200, 110)),
]

def draw_scene(cw, ch, mode):
    im = Image.new('RGB', (cw, ch), (10, 12, 18))
    d = ImageDraw.Draw(im)
    horizon = int(ch * 0.55)
    if mode == 'beauty':
        for y in range(horizon):
            t = y/horizon; d.line([(0,y),(cw,y)], fill=(int(20+t*40), int(30+t*50), int(60+t*45)))
        for y in range(horizon,ch):
            t=(y-horizon)/(ch-horizon); g=int(70+t*80)
            d.line([(0,y),(cw,y)], fill=(g,g-8,g-25))
    elif mode == 'depth':
        for y in range(ch):
            if y<horizon: g=250
            else:
                t=(y-horizon)/(ch-horizon); g=int(200-t*180)
            d.line([(0,y),(cw,y)], fill=(g,g,g))
    elif mode == 'normal':
        for y in range(ch):
            if y<horizon: d.line([(0,y),(cw,y)], fill=(0,0,0))
            else: d.line([(0,y),(cw,y)], fill=(127,240,127))
    elif mode == 'albedo':
        for y in range(horizon): d.line([(0,y),(cw,y)], fill=(35,45,60))
        for y in range(horizon,ch): d.line([(0,y),(cw,y)], fill=(120,110,90))
    elif mode == 'ao':
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(230,230,230))
    elif mode == 'diffuse_direct':
        for y in range(ch):
            if y<horizon: d.line([(0,y),(cw,y)], fill=(0,0,0))
            else:
                t=(y-horizon)/(ch-horizon); g=int(80+t*60)
                d.line([(0,y),(cw,y)], fill=(g,g-5,g-20))
    elif mode in ('specular','crypto','motion','uv'):
        for y in range(ch): d.line([(0,y),(cw,y)], fill=(0,0,0))
    elif mode == 'position':
        overlay = Image.new('RGB',(cw,ch),(0,0,0)); od=ImageDraw.Draw(overlay)
        for x in range(cw):
            for y in range(ch):
                overlay.putpixel((x,y),(int(255*x/cw), int(255*(1-y/ch)), 120))
        im = overlay; d = ImageDraw.Draw(im)

    for idx,(nx, ny, nr, color) in enumerate(SPHERES):
        cx,cy,r = nx*cw, ny*ch, nr*min(cw,ch)
        for py in range(max(0,int(cy-r)), min(ch,int(cy+r+1))):
            for px in range(max(0,int(cx-r)), min(cw,int(cx+r+1))):
                dx,dy=px-cx,py-cy; d2=dx*dx+dy*dy
                if d2>r*r: continue
                z=math.sqrt(max(0.0,r*r-d2))/r
                nx_=dx/r; ny_=dy/r
                if mode=='beauty':
                    ldx,ldy,ldz=-0.4,-0.5,0.75
                    ndot=max(0,nx_*ldx+ny_*ldy+z*ldz)
                    lit=0.25+0.75*ndot
                    im.putpixel((px,py),tuple(min(255,int(c*lit+40*(ndot**8))) for c in color))
                elif mode=='depth':
                    layer_depth=0.35+idx*0.15; g=int(max(0,min(255,(layer_depth-z*0.05)*255)))
                    im.putpixel((px,py),(g,g,g))
                elif mode=='normal':
                    im.putpixel((px,py),(int((nx_*0.5+0.5)*255), int((-ny_*0.5+0.5)*255), int((z*0.5+0.5)*255)))
                elif mode=='albedo':
                    im.putpixel((px,py),color)
                elif mode=='ao':
                    edge=z**0.6; g=int(80+175*edge)
                    im.putpixel((px,py),(g,g,g))
                elif mode=='diffuse_direct':
                    ldx,ldy,ldz=-0.4,-0.5,0.75
                    ndot=max(0,nx_*ldx+ny_*ldy+z*ldz); lit=0.15+0.75*ndot
                    im.putpixel((px,py),tuple(min(255,int(c*lit*0.85)) for c in color))
                elif mode=='specular':
                    ldx,ldy,ldz=-0.4,-0.5,0.75
                    ndot=max(0,nx_*ldx+ny_*ldy+z*ldz); g=int((ndot**32)*255)
                    im.putpixel((px,py),(g,g,g))
                elif mode=='crypto':
                    ccols=[(240,120,90),(100,220,180),(180,120,240)]
                    im.putpixel((px,py),ccols[idx])
                elif mode=='motion':
                    if idx==1: im.putpixel((px,py),(110,200,240))
                    else: im.putpixel((px,py),(30,30,40))
                elif mode=='position':
                    im.putpixel((px,py),(int(px/cw*255), int((1-py/ch)*255), int((z*0.5+0.5)*180)))
                elif mode=='uv':
                    u=math.atan2(nx_, z if z>0 else 0.001)/math.pi*0.5+0.5; v=ny_*0.5+0.5
                    im.putpixel((px,py),(int(u*255),int(v*255),0))
        if mode=='ao':
            od=ImageDraw.Draw(im)
            for i in range(3):
                od.ellipse([cx-r*1.2+i, cy+r*0.7-i//2, cx+r*1.2-i, cy+r*0.9+i//2], fill=(120+i*30,120+i*30,120+i*30))
    return im

# ============================================================
# 1. EXR 全レイヤータイル画像（日本語ラベル・非技術者向け）
# ============================================================
def gen_exr_alllayers():
    W, H = 1600, 1050
    BG=(13,13,15); CARD=(28,28,34); BORDER=(60,60,72)
    TEXT=(242,243,247); TEXT2=(180,180,196); ACC=(165,107,240)
    img = Image.new('RGB',(W,H),BG); draw = ImageDraw.Draw(img)

    # ヘッダ
    draw.rectangle([0,0,W,90], fill=(22,22,28))
    draw.line([(0,90),(W,90)], fill=BORDER, width=1)
    draw.text((40,20), '🎨 EXR ファイルの中身を全部プレビュー', font=font(32), fill=TEXT)
    draw.text((40,60), 'CG レンダー出力に含まれる「情報の層」を、ブラウザだけで種類別に確認できます',
              font=font(16), fill=TEXT2)

    cols, rows = 4, 3
    tile_w, tile_h = 340, 300
    prev_h = 190
    gap = 18
    total_w = cols*tile_w + (cols-1)*gap
    grid_x = (W - total_w)//2
    grid_y = 120

    # (レイヤー技術名, 描画モード, 日本語ラベル, ひとこと説明)
    layers = [
        ('beauty',        'beauty',        '完成映像',        '仕上がった状態'),
        ('albedo',        'albedo',        '素の色',          '陰影なしの色'),
        ('AO',            'ao',            '影の濃さ',        '接触部の陰り'),
        ('diffuse_direct','diffuse_direct','光の当たり方',    '直接光の分'),
        ('specular',      'specular',      'ハイライト',      '反射のツヤ'),
        ('N',             'normal',        '面の向き',        '表面の角度情報'),
        ('Z',             'depth',         '奥行き',          'カメラからの距離'),
        ('P',             'position',      '3D 空間の位置',   'ワールド座標'),
        ('UV',            'uv',            'テクスチャ座標',  '模様の貼付け位置'),
        ('motion_vector', 'motion',        '動きの向き',      '次のコマへの動き'),
        ('crypto_object', 'crypto',        'パーツ分離 (1)',  'オブジェクト単位'),
        ('crypto_asset',  'crypto',        'パーツ分離 (2)',  'アセット単位'),
    ]

    for i, (name, mode, jp_name, jp_desc) in enumerate(layers):
        col = i%cols; row = i//cols
        x = grid_x + col*(tile_w+gap); y = grid_y + row*(tile_h+gap)
        draw.rectangle([x,y,x+tile_w,y+tile_h], fill=CARD, outline=BORDER, width=1)
        prev = draw_scene(tile_w, prev_h, mode)
        img.paste(prev, (x,y))
        draw.line([(x,y+prev_h),(x+tile_w,y+prev_h)], fill=BORDER, width=1)
        # 日本語ラベル（大）
        draw.text((x+16, y+prev_h+12), jp_name, font=font(22), fill=TEXT)
        # 説明（小）
        draw.text((x+16, y+prev_h+48), jp_desc, font=font(14), fill=TEXT2)
        # 技術名（右下・小さく）
        bbox = draw.textbbox((0,0), name, font=font(11))
        tw = bbox[2]-bbox[0]
        draw.text((x+tile_w-tw-12, y+prev_h+72), name, font=font(11), fill=(120,120,140))

    img.save('slides_assets/exr_alllayers.png', 'PNG', optimize=True)
    print('saved: slides_assets/exr_alllayers.png')

# ============================================================
# 2. R2 構成図（シンプル・非技術者向け）
# ============================================================
def gen_r2_diagram():
    W, H = 1600, 900
    BG=(13,13,15); CARD=(30,30,38); BORDER=(70,70,85)
    TEXT=(242,243,247); TEXT2=(190,190,210); ACC=(165,107,240)
    CLOUD=(90,155,255); OK=(100,210,140); GRAY=(150,150,170)
    img = Image.new('RGB',(W,H),BG); draw = ImageDraw.Draw(img)

    # タイトル
    draw.text((60, 40), 'クラウド保管に対応（ネット経由でチーム共有）', font=font(36), fill=TEXT)
    draw.text((60, 92), '会社の PC でも、家でも、出張先でも。同じデータをブラウザだけで開けます。',
              font=font(18), fill=TEXT2)

    # 中央の巨大な雲アイコン
    cx, cy = W//2, 360
    # 雲：円を組み合わせて描画
    r = 130
    draw.ellipse([cx-r*1.8, cy-r*0.9, cx-r*0.6, cy+r*0.6], fill=CARD, outline=CLOUD, width=4)
    draw.ellipse([cx-r*0.9, cy-r*1.3, cx+r*0.7, cy+r*0.4], fill=CARD, outline=CLOUD, width=4)
    draw.ellipse([cx+r*0.3, cy-r*0.8, cx+r*1.8, cy+r*0.6], fill=CARD, outline=CLOUD, width=4)
    draw.rectangle([cx-r*1.5, cy-r*0.1, cx+r*1.5, cy+r*0.6], fill=CARD, outline=BG, width=6)
    draw.rectangle([cx-r*1.5, cy-r*0.1, cx+r*1.5, cy+r*0.6], fill=CARD, outline=CLOUD, width=4)
    draw.line([(cx-r*1.5, cy-r*0.1), (cx+r*1.5, cy-r*0.1)], fill=CARD, width=6)

    # 雲の中央にラベル
    txt = 'LayCAT クラウド保管庫'
    bbox = draw.textbbox((0,0), txt, font=font(24))
    tw = bbox[2]-bbox[0]
    draw.text((cx-tw//2, cy-20), txt, font=font(24), fill=TEXT)
    txt2 = '（プロジェクトのデータ）'
    bbox = draw.textbbox((0,0), txt2, font=font(15))
    tw = bbox[2]-bbox[0]
    draw.text((cx-tw//2, cy+18), txt2, font=font(15), fill=TEXT2)

    # 招待メンバー（左）
    def draw_person(px, py, is_member, label, sub):
        color = OK if is_member else (200, 100, 100)
        # 頭
        draw.ellipse([px-25, py-30, px+25, py+20], fill=color, outline=None)
        # 体
        draw.rounded_rectangle([px-40, py+15, px+40, py+80], radius=15, fill=color)
        # ラベル
        bbox = draw.textbbox((0,0), label, font=font(18))
        tw = bbox[2]-bbox[0]
        draw.text((px-tw//2, py+95), label, font=font(18), fill=TEXT)
        bbox = draw.textbbox((0,0), sub, font=font(13))
        tw = bbox[2]-bbox[0]
        draw.text((px-tw//2, py+123), sub, font=font(13), fill=TEXT2)

    # 招待メンバー 3 人（左側）
    m_labels = [('チームメンバー A', '会社の PC から'), ('チームメンバー B', '在宅から'), ('外注の作画さん', '自宅から')]
    for i, (lab, sub) in enumerate(m_labels):
        px = 260; py = 260 + i*160
        draw_person(px, py, True, lab, sub)
        # 矢印（メンバー → 雲）
        draw.line([(px+50, py+30), (cx-r*1.8, py+30)], fill=OK, width=3)
        # OK チェック
        arrow_mid_x = (px+50 + cx-r*1.8)//2
        draw.ellipse([arrow_mid_x-14, py+15, arrow_mid_x+14, py+43], fill=OK)
        draw.text((arrow_mid_x-8, py+18), '✓', font=font(20), fill=(255,255,255))

    # 招待されていない人（右）
    npx, npy = W - 260, 420
    draw_person(npx, npy, False, '関係ない人', '（他社・他プロジェクト）')
    # 矢印（× で拒否）
    draw.line([(cx+r*1.8, npy+30), (npx-50, npy+30)], fill=(200,100,100), width=3)
    # × バツ
    bx = (cx+r*1.8 + npx-50)//2
    draw.ellipse([bx-18, npy+12, bx+18, npy+48], fill=(200,60,60))
    draw.line([(bx-9, npy+21),(bx+9, npy+39)], fill=(255,255,255), width=4)
    draw.line([(bx+9, npy+21),(bx-9, npy+39)], fill=(255,255,255), width=4)
    # 「入れない」注記
    draw.text((npx-70, npy+150), 'アクセス不可', font=font(15), fill=(220,120,120))

    # 下部のメリット説明（3 つのカード）
    footer_y = 640
    draw.line([(60, footer_y),(W-60, footer_y)], fill=BORDER, width=1)
    benefits = [
        ('🌏', 'どこからでも見られる', '会社・自宅・出先どこでも同じデータ'),
        ('🔒', '決まった人だけがアクセス', '招待されたメンバー以外は入れない'),
        ('📊', '安全に保管', '容量制限＋アクセス履歴で守られる'),
    ]
    card_w = (W - 120 - 40) // 3
    card_h = 170
    for i, (icon, title, desc) in enumerate(benefits):
        bx = 60 + i*(card_w + 20)
        by = footer_y + 30
        draw.rounded_rectangle([bx, by, bx+card_w, by+card_h], radius=14, fill=CARD, outline=BORDER, width=1)
        draw.text((bx+30, by+22), icon, font=font(40), fill=ACC)
        draw.text((bx+95, by+30), title, font=font(22), fill=TEXT)
        draw.text((bx+30, by+95), desc, font=font(16), fill=TEXT2)

    img.save('slides_assets/r2_architecture.png', 'PNG', optimize=True)
    print('saved: slides_assets/r2_architecture.png')

if __name__ == '__main__':
    gen_exr_alllayers()
    gen_r2_diagram()
