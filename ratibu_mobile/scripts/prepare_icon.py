from PIL import Image
import os

def prepare_icon():
    # Paths
    insignia_path = r"c:\Users\evince\Downloads\Ratibu\insignia bg.png"
    output_path = r"c:\Users\evince\Downloads\Ratibu\ratibu_mobile\assets\images\app_icon.png"
    
    # Create white canvas 1024x1024
    canvas_size = (1024, 1024)
    canvas = Image.new("RGB", canvas_size, "white")
    
    # Open insignia
    insignia = Image.open(insignia_path)
    
    # Scale insignia to fit well within adaptive icon safe zone (66%)
    # 66% of 1024 is ~675
    target_size = 700
    insignia.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Center it
    offset = ((canvas_size[0] - insignia.size[0]) // 2, (canvas_size[1] - insignia.size[1]) // 2)
    canvas.paste(insignia, offset, insignia if insignia.mode == 'RGBA' else None)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save
    canvas.save(output_path)
    print(f"App icon prepared at {output_path}")

if __name__ == "__main__":
    prepare_icon()
