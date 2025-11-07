import qrcode
import base64
from io import BytesIO
import uuid

def generate_qr_code(data: str) -> str:
    """Generate QR code and return base64 encoded image"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return img_str

def generate_unique_qr_data(user_id: int, event_id: int) -> str:
    """Generate unique QR code data"""
    unique_id = str(uuid.uuid4())
    return f"EVENT:{event_id}:USER:{user_id}:{unique_id}"