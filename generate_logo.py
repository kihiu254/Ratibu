from PIL import Image, ImageDraw, ImageFont
import os

# Create a white image
width = 400
height = 120
image = Image.new('RGB', (width, height), 'white')
draw = ImageDraw.Draw(image)

# Add text (basic fallback since we might not have fonts)
try:
    font = ImageFont.truetype("arial.ttf", 40)
except IOError:
    font = ImageFont.load_default()

text = "RATIBU"
text_width, text_height = draw.textsize(text, font=font) if hasattr(draw, "textsize") else (150, 40)
position = ((width - text_width) / 2, (height - text_height) / 2)

draw.text(position, text, fill=(0, 0, 255), font=font)

# Save
output_path = "pesachama-web-new/src/assets/logo.png"
os.makedirs(os.path.dirname(output_path), exist_ok=True)
image.save(output_path)
print(f"Created placeholder logo at {output_path}")
