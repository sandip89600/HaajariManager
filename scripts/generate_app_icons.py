import os
import shutil
from PIL import Image, ImageOps

SRC_IMAGE_PATH = r"C:\Users\Lenovo\.gemini\antigravity\brain\e59d4a00-75dd-40b2-82c0-4bf49e0f1b80\.user_uploaded\media_1793461652454_e4667fcf.png"
PROJECT_ROOT = r"d:\File\HaajariManager (3)\HaajariManager"
FRONTEND_IMAGES = os.path.join(PROJECT_ROOT, "frontend", "assets", "images")
ANDROID_RES = os.path.join(PROJECT_ROOT, "frontend", "android", "app", "src", "main", "res")

BG_COLOR = (227, 92, 49, 255) # #E35C31
BG_HEX = "#E35C31"

print(f"Loading source image: {SRC_IMAGE_PATH}")
src_img = Image.open(SRC_IMAGE_PATH).convert("RGBA")
print(f"Source size: {src_img.size}")

# 1. Backup existing assets
backup_dir = os.path.join(FRONTEND_IMAGES, "backup_20261031")
os.makedirs(backup_dir, exist_ok=True)
for fname in ["icon.png", "splash-icon.png", "android-icon-foreground.png", "android-icon-background.png", "android-icon-monochrome.png"]:
    p = os.path.join(FRONTEND_IMAGES, fname)
    if os.path.exists(p):
        shutil.copy2(p, os.path.join(backup_dir, fname))
print(f"Backed up frontend assets to: {backup_dir}")

# 2. Generate frontend/assets/images/icon.png (1024x1024)
icon_path = os.path.join(FRONTEND_IMAGES, "icon.png")
src_img.save(icon_path, format="PNG", optimize=True)
print(f"Saved: {icon_path} (1024x1024)")

# 3. Generate frontend/assets/images/splash-icon.png (1024x1024)
splash_path = os.path.join(FRONTEND_IMAGES, "splash-icon.png")
src_img.save(splash_path, format="PNG", optimize=True)
print(f"Saved: {splash_path} (1024x1024)")

# 4. Generate android-icon-foreground.png (1024x1024)
# In Android adaptive icons, the visible mask viewport is central 66.7% (72dp of 108dp).
# Scaling to ~74% (758x758) centered on a transparent 1024x1024 canvas ensures the emblem
# is completely visible on any Android launcher mask (circle, square, rounded rect).
fg_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
scale_w = 758
scale_h = 758
scaled_icon = src_img.resize((scale_w, scale_h), Image.Resampling.LANCZOS)
offset_x = (1024 - scale_w) // 2
offset_y = (1024 - scale_h) // 2
fg_canvas.paste(scaled_icon, (offset_x, offset_y), scaled_icon)
fg_path = os.path.join(FRONTEND_IMAGES, "android-icon-foreground.png")
fg_canvas.save(fg_path, format="PNG", optimize=True)
print(f"Saved: {fg_path} (Adaptive foreground centered)")

# 5. Generate android-icon-background.png (1024x1024 solid #E35C31)
bg_canvas = Image.new("RGBA", (1024, 1024), BG_COLOR)
bg_path = os.path.join(FRONTEND_IMAGES, "android-icon-background.png")
bg_canvas.save(bg_path, format="PNG", optimize=True)
print(f"Saved: {bg_path} (Adaptive background)")

# 6. Generate android-icon-monochrome.png (1024x1024)
mono_path = os.path.join(FRONTEND_IMAGES, "android-icon-monochrome.png")
fg_canvas.save(mono_path, format="PNG", optimize=True)
print(f"Saved: {mono_path} (Adaptive monochrome)")

# 7. Generate Android native splashscreen_logo.png in drawable-*
drawable_densities = {
    "drawable-mdpi": (288, 288),
    "drawable-hdpi": (432, 432),
    "drawable-xhdpi": (576, 576),
    "drawable-xxhdpi": (864, 864),
    "drawable-xxxhdpi": (1152, 1152),
}
for d_name, (w, h) in drawable_densities.items():
    d_dir = os.path.join(ANDROID_RES, d_name)
    if os.path.exists(d_dir):
        out_file = os.path.join(d_dir, "splashscreen_logo.png")
        resized = src_img.resize((w, h), Image.Resampling.LANCZOS)
        resized.save(out_file, format="PNG", optimize=True)
        print(f"Saved: {out_file} ({w}x{h})")

# 8. Generate Android native mipmap icons
mipmap_densities = {
    "mipmap-mdpi": {"launcher": 48, "layer": 108},
    "mipmap-hdpi": {"launcher": 72, "layer": 162},
    "mipmap-xhdpi": {"launcher": 96, "layer": 216},
    "mipmap-xxhdpi": {"launcher": 144, "layer": 324},
    "mipmap-xxxhdpi": {"launcher": 192, "layer": 432},
}

for m_name, sizes in mipmap_densities.items():
    m_dir = os.path.join(ANDROID_RES, m_name)
    if os.path.exists(m_dir):
        l_size = sizes["launcher"]
        layer_size = sizes["layer"]
        
        # ic_launcher.webp
        launcher_img = src_img.resize((l_size, l_size), Image.Resampling.LANCZOS)
        launcher_img.save(os.path.join(m_dir, "ic_launcher.webp"), format="WEBP", quality=95)
        
        # ic_launcher_round.webp (create circular masked icon)
        circle_mask = Image.new("L", (l_size, l_size), 0)
        from PIL import ImageDraw
        draw = ImageDraw.Draw(circle_mask)
        draw.ellipse((0, 0, l_size - 1, l_size - 1), fill=255)
        round_img = Image.new("RGBA", (l_size, l_size), (0, 0, 0, 0))
        # Fill circle with background color, then paste scaled emblem
        bg_circle = Image.new("RGBA", (l_size, l_size), BG_COLOR)
        round_img.paste(bg_circle, (0, 0), circle_mask)
        scaled_for_round = src_img.resize((int(l_size * 0.95), int(l_size * 0.95)), Image.Resampling.LANCZOS)
        r_off = (l_size - scaled_for_round.width) // 2
        round_img.paste(scaled_for_round, (r_off, r_off), scaled_for_round)
        # Apply circle mask to whole result
        final_round = Image.new("RGBA", (l_size, l_size), (0, 0, 0, 0))
        final_round.paste(round_img, (0, 0), circle_mask)
        final_round.save(os.path.join(m_dir, "ic_launcher_round.webp"), format="WEBP", quality=95)

        # ic_launcher_foreground.webp
        fg_layer = fg_canvas.resize((layer_size, layer_size), Image.Resampling.LANCZOS)
        fg_layer.save(os.path.join(m_dir, "ic_launcher_foreground.webp"), format="WEBP", quality=95)

        # ic_launcher_background.webp
        bg_layer = Image.new("RGBA", (layer_size, layer_size), BG_COLOR)
        bg_layer.save(os.path.join(m_dir, "ic_launcher_background.webp"), format="WEBP", quality=95)

        # ic_launcher_monochrome.webp
        fg_layer.save(os.path.join(m_dir, "ic_launcher_monochrome.webp"), format="WEBP", quality=95)
        print(f"Updated mipmap density: {m_name}")

print("\nAll icon and splash screen assets generated successfully!")
