from PIL import Image
import os
import math

input_path = "ratibu_mobile/assets/images/app_logo_final.png" # Assuming this is the original wide logo
output_path1 = "ratibu_mobile/assets/images/launcher_foreground.png"
output_path2 = "ratibu_mobile/assets/images/logo_square.png"

try:
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    # We want the logo to be centered in a square that is large enough
    # For Android 12 splash screens, the icon is placed inside a circular mask
    # So we need enough padding so the edges don't get cut off.
    # The inner circle radius is usually around 1/3 of the width.
    # Let's make the canvas size 1.5 * max(w, h)
    
    max_dim = max(w, h)
    canvas_size = int(max_dim * 1.5)
    
    # Create transparent canvas
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # Calculate top-left pos to center
    x = (canvas_size - w) // 2
    y = (canvas_size - h) // 2
    
    canvas.paste(img, (x, y), img)
    
    canvas.save(output_path1, format="PNG")
    canvas.save(output_path2, format="PNG")
    print("Successfully padded images.")

except Exception as e:
    print(f"Error: {e}")
