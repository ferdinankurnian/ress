"""Generate standalone brand PNGs from Ress's existing icon and font."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
out = root / 'assets/brand'
out.mkdir(parents=True, exist_ok=True)
ink = '#25271F'
yellow = '#F5D547'
source = Image.open(root / 'assets/icon.png').convert('RGBA')
mask = source.convert('L').point(lambda v: 255 if v < 100 else 0)
mark = Image.new('RGBA', source.size, ink)
mark.putalpha(mask)
mark = mark.crop(mask.getbbox())
icon = Image.new('RGBA', (1024, 1024))
ImageDraw.Draw(icon).rounded_rectangle((0, 0, 1023, 1023), radius=240, fill=yellow)
scale = min(760 / mark.width, 660 / mark.height)
mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.Resampling.LANCZOS)
icon.alpha_composite(mark, ((1024-mark.width)//2, (1024-mark.height)//2))
icon.save(out / 'ress-icon.png')
font = ImageFont.truetype(str(root / 'node_modules/@expo-google-fonts/vollkorn/600SemiBold/Vollkorn_600SemiBold.ttf'), 400)
box = font.getbbox('ress')
word = Image.new('RGBA', (box[2]-box[0]+8, box[3]-box[1]+8))
ImageDraw.Draw(word).text((4-box[0], 4-box[1]), 'ress', font=font, fill=ink)
word.save(out / 'ress-wordmark.png')
lockup = Image.new('RGBA', (512+80+word.width, 512))
lockup.alpha_composite(icon.resize((512,512), Image.Resampling.LANCZOS))
lockup.alpha_composite(word, (592, (512-word.height)//2))
lockup.save(out / 'ress-lockup.png')
