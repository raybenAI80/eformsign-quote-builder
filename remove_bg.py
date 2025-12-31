from PIL import Image
import sys

def remove_white_background(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Change all white (also shades of whites)
            # Find all pixels that are white-ish (R>240, G>240, B>240)
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print("Successfully saved transparent image to", output_path)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    input_file = r"C:/Users/FORCS/.gemini/antigravity/brain/51a6e74a-a58a-47bf-8461-81e47736c390/uploaded_image_1767144024373.png"
    output_file = r"c:/eformsign-견적서-빌더/public/ai-icon.png"
    remove_white_background(input_file, output_file)
