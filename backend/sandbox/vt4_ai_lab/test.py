import os
from dotenv import load_dotenv
from google import genai
from PIL import Image


load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Read text book
MODEL_NAME = 'gemini-3.1-flash-lite'
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
HANDBOOK_PATH = os.path.join(CURRENT_DIR, 'sample_handbook.txt')
IMAGE_PATH = os.path.join(CURRENT_DIR, 'sample_image.png')


try:
    with open(HANDBOOK_PATH, 'r', encoding='utf-8') as file:
        medical_context = file.read()
except FileNotFoundError:
    print(f"Error: Could not find '{HANDBOOK_PATH}'.")
    exit(1)


# Very simple RAG
question = "Ibuprofen có tác dụng gì?"

prompt = f"""
Bạn là một trợ lý y tế ảo thông minh. Dưới đây là nội dung trích xuất từ cẩm nang y tế:

<tai_lieu>
{medical_context}
</tai_lieu>

Yêu cầu: {question}
Ngôn ngữ: Tiếng Việt
Chỉ trả lời dựa trên thông tin được cung cấp trong tài liệu. Nếu tài liệu không đề cập, hãy nói "Tài liệu không có thông tin về vấn đề này".
"""

image_prompt = "Đây là hình ảnh gì? Hãy trích xuất các thông tin y tế quan trọng (như tên thuốc, thành phần, liều lượng) có trong ảnh này bằng tiếng Việt."



# API call
print("Calling Gemini API...")
try:
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )
    # Test on text
    print("\n" + "="*40)
    print("Text result:")
    print("="*40)
    print(response.text)

    # Test on image
    if os.path.exists(IMAGE_PATH):
        print("\nAnalizing image...")
        image = Image.open(IMAGE_PATH)


        image_response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[image, image_prompt]
        )
        
        print("\n" + "="*40)
        print("Image result:")
        print("="*40)
        print(image_response.text)
    else:
        print(f"\nCould not find: {IMAGE_PATH}.")

except Exception as e:
    print(f"Error when called API: {e}")
finally:
    # Close the sync client to release resources.
    client.close()



