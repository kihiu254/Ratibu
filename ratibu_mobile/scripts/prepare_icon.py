from pathlib import Path
from PIL import Image


ROOT = Path(r"c:\Users\evince\Downloads\Ratibu")
SOURCE = ROOT / "ratibu_mobile" / "assets" / "images" / "logo.png"
OUTPUT = ROOT / "ratibu_mobile" / "assets" / "images" / "app_icon.png"
BACKGROUND = (0, 200, 83)


def crop_non_white(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    min_x, min_y = width, height
    max_x, max_y = -1, -1

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0 and (r < threshold or g < threshold or b < threshold):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < 0 or max_y < 0:
        return rgba

    pad = int(max(width, height) * 0.01)
    left = max(0, min_x - pad)
    top = max(0, min_y - pad)
    right = min(width, max_x + pad + 1)
    bottom = min(height, max_y + pad + 1)
    return rgba.crop((left, top, right, bottom))


def make_white_transparent(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (255, 255, 255, 0)
    return rgba


def make_black_transparent(image: Image.Image, threshold: int = 60) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def prepare_icon() -> None:
    source = Image.open(SOURCE)
    source = make_white_transparent(source)
    source = make_black_transparent(source)
    source = crop_non_white(source)

    canvas_size = (1024, 1024)
    canvas = Image.new("RGBA", canvas_size, BACKGROUND + (255,))

    target_size = int(min(canvas_size) * 0.84)
    source.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)

    offset = ((canvas_size[0] - source.size[0]) // 2, (canvas_size[1] - source.size[1]) // 2)
    canvas.alpha_composite(source, offset)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT)
    print(f"Prepared icon at {OUTPUT}")


if __name__ == "__main__":
    prepare_icon()
