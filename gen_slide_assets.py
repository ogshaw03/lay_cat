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

    # (レイヤー名, 描画モード, ひとこと説明)
    layers = [
        ('beauty',        'beauty',        '完成映像'),
        ('albedo',        'albedo',        '素の色（陰影なし）'),
        ('AO',            'ao',            '接触部の影'),
        ('diffuse_direct','diffuse_direct','光の当たり方'),
        ('specular',      'specular',      'ハイライト（ツヤ）'),
        ('N',             'normal',        '面の向き'),
        ('Z',             'depth',         '奥行き（カメラからの距離）'),
        ('P',             'position',      '3D 空間の位置'),
        ('UV',            'uv',            'テクスチャ座標'),
        ('motion_vector', 'motion',        '動きの向き'),
        ('crypto_object', 'crypto',        'オブジェクト単位のパーツ分離'),
        ('crypto_asset',  'crypto',        'アセット単位のパーツ分離'),
    ]

    for i, (name, mode, jp_desc) in enumerate(layers):
        col = i%cols; row = i//cols
        x = grid_x + col*(tile_w+gap); y = grid_y + row*(tile_h+gap)
        draw.rectangle([x,y,x+tile_w,y+tile_h], fill=CARD, outline=BORDER, width=1)
        prev = draw_scene(tile_w, prev_h, mode)
        img.paste(prev, (x,y))
        draw.line([(x,y+prev_h),(x+tile_w,y+prev_h)], fill=BORDER, width=1)
        # レイヤー名（そのまま英語で大きく表示）
        draw.text((x+16, y+prev_h+12), name, font=font(22), fill=TEXT)
        # 日本語説明
        draw.text((x+16, y+prev_h+50), jp_desc, font=font(15), fill=TEXT2)

    img.save('slides_assets/exr_alllayers.png', 'PNG', optimize=True)
    print('saved: slides_assets/exr_alllayers.png')

# ============================================================
# 2. R2 構成図（シンプル・非技術者向け）
# ============================================================
def gen_r2_diagram():
    W, H = 1600, 900
    BG=(13,13,15); CARD=(30,30,38); CARD_HL=(40,40,52); BORDER=(75,75,90)
    TEXT=(242,243,247); TEXT2=(190,190,210); ACC=(165,107,240)
    CLOUD=(90,155,255); OK=(100,210,140); GRAY=(150,150,170)
    ORANGE=(243,130,30)  # Cloudflare 系
    img = Image.new('RGB',(W,H),BG); draw = ImageDraw.Draw(img)

    # タイトル
    draw.text((60, 34), 'クラウドストレージ対応（プロジェクトデータをネット共有）', font=font(30), fill=TEXT)
    draw.text((60, 78), 'ブラウザ → 受付係（Worker） → 保管庫（バケット）の 3 段階で安全にやりとり',
              font=font(16), fill=TEXT2)

    # 3 段階のボックス配置
    # ①ユーザー ②Worker（受付・門番） ③バケット（保管庫）
    box_y = 160
    box_h = 380
    # ボックス幅は 3 等分
    b1_x, b1_w = 60,  380  # ユーザー
    b2_x, b2_w = 610, 380  # Worker
    b3_x, b3_w = 1160, 380 # バケット

    # ---- ① ユーザー（ブラウザ） ----
    draw.rounded_rectangle([b1_x, box_y, b1_x+b1_w, box_y+box_h], radius=14, fill=CARD, outline=BORDER, width=2)
    draw.text((b1_x+20, box_y+18), '👤 チームメンバー', font=font(22), fill=TEXT)
    draw.text((b1_x+20, box_y+54), '（ブラウザで LayCAT を開く）', font=font(14), fill=TEXT2)
    # 人アイコン 3 つ
    persons = [('会社の PC から', OK), ('在宅で', OK), ('出張先で', OK)]
    for i,(lab,col) in enumerate(persons):
        py = box_y + 100 + i*90
        # 頭＋体
        draw.ellipse([b1_x+40, py, b1_x+80, py+40], fill=col)
        draw.rounded_rectangle([b1_x+30, py+40, b1_x+90, py+80], radius=10, fill=col)
        # ラベル
        draw.text((b1_x+110, py+18), lab, font=font(18), fill=TEXT)
        draw.text((b1_x+110, py+46), '同じプロジェクトを開ける', font=font(13), fill=TEXT2)

    # ---- ② Worker（受付・門番） ----
    draw.rounded_rectangle([b2_x, box_y, b2_x+b2_w, box_y+box_h], radius=14, fill=CARD, outline=ORANGE, width=3)
    draw.text((b2_x+20, box_y+18), '🚪 Worker（受付係）', font=font(22), fill=ORANGE)
    draw.text((b2_x+20, box_y+54), 'Cloudflare の小さなサーバー', font=font(14), fill=TEXT2)
    # 3 つの役割
    roles = [
        ('👥', '本人確認', 'ログイン中のユーザーか確認'),
        ('🔑', 'メンバーチェック', 'そのプロジェクトの招待メンバーか判定'),
        ('📏', 'ファイル検査', 'サイズ制限・アクセス履歴の記録'),
    ]
    for i,(ic,t,d) in enumerate(roles):
        ry = box_y + 100 + i*90
        draw.rounded_rectangle([b2_x+15, ry, b2_x+b2_w-15, ry+80], radius=8, fill=CARD_HL, outline=BORDER, width=1)
        draw.text((b2_x+28, ry+22), ic, font=font(28), fill=ORANGE)
        draw.text((b2_x+80, ry+16), t, font=font(17), fill=TEXT)
        draw.text((b2_x+80, ry+46), d, font=font(13), fill=TEXT2)

    # ---- ③ バケット（保管庫） ----
    draw.rounded_rectangle([b3_x, box_y, b3_x+b3_w, box_y+box_h], radius=14, fill=CARD, outline=CLOUD, width=2)
    draw.text((b3_x+20, box_y+18), '🪣 バケット（保管庫）', font=font(22), fill=CLOUD)
    draw.text((b3_x+20, box_y+54), 'Cloudflare R2（クラウドストレージ）', font=font(14), fill=TEXT2)
    # 各プロジェクトを表現
    projects = [
        ('プロジェクト A', 'アニメ第1話'),
        ('プロジェクト B', '短編CG'),
        ('プロジェクト C', 'PV制作'),
    ]
    for i,(pn,pd) in enumerate(projects):
        py = box_y + 100 + i*90
        draw.rounded_rectangle([b3_x+15, py, b3_x+b3_w-15, py+80], radius=8, fill=CARD_HL, outline=BORDER, width=1)
        # 鍵アイコン
        draw.text((b3_x+28, py+22), '🔒', font=font(28), fill=OK)
        draw.text((b3_x+80, py+13), pn, font=font(17), fill=TEXT)
        draw.text((b3_x+80, py+38), pd, font=font(13), fill=TEXT2)
        draw.text((b3_x+80, py+58), '動画・EXR・コメント履歴', font=font(11), fill=(140,140,160))

    # ---- 矢印 ----
    # ① → ②
    arr_y = box_y + box_h//2
    draw.line([(b1_x+b1_w+5, arr_y),(b2_x-5, arr_y)], fill=ORANGE, width=4)
    draw.polygon([(b2_x-5, arr_y),(b2_x-20, arr_y-10),(b2_x-20, arr_y+10)], fill=ORANGE)
    draw.text((b1_x+b1_w+30, arr_y-42), 'アクセス要求', font=font(13), fill=TEXT2)

    # ② → ③
    draw.line([(b2_x+b2_w+5, arr_y),(b3_x-5, arr_y)], fill=OK, width=4)
    draw.polygon([(b3_x-5, arr_y),(b3_x-20, arr_y-10),(b3_x-20, arr_y+10)], fill=OK)
    draw.text((b2_x+b2_w+30, arr_y-42), '許可 OK → 実行', font=font(13), fill=TEXT2)

    # ---- 下部：メリット説明 ----
    footer_y = 590
    draw.line([(60, footer_y),(W-60, footer_y)], fill=BORDER, width=1)
    benefits = [
        ('🌏', 'どこからでも見られる', '会社・自宅・出先どこでも、同じデータをブラウザで開ける'),
        ('🔒', '決まった人だけがアクセス', '招待されたメンバー以外は Worker で拒否'),
        ('📊', '安全に保管・追跡可能', 'ファイルサイズ制限＋全アクセスの記録が残る'),
        ('🔄', '従来のフォルダ運用と併用', 'プロジェクト単位でクラウド／フォルダを選べる'),
    ]
    card_w = (W - 120 - 60) // 4
    card_h = 200
    for i,(ic, t, d) in enumerate(benefits):
        bx = 60 + i*(card_w + 20)
        by = footer_y + 30
        draw.rounded_rectangle([bx, by, bx+card_w, by+card_h], radius=14, fill=CARD, outline=BORDER, width=1)
        draw.text((bx+20, by+16), ic, font=font(34), fill=ACC)
        draw.text((bx+20, by+66), t, font=font(17), fill=TEXT)
        # 説明を wrap して 2 行に
        draw.text((bx+20, by+102), d, font=font(12), fill=TEXT2)

    img.save('slides_assets/r2_architecture.png', 'PNG', optimize=True)
    print('saved: slides_assets/r2_architecture.png')

if __name__ == '__main__':
    gen_exr_alllayers()
    gen_r2_diagram()
