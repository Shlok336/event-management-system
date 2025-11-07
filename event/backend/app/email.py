import asyncio
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import base64
import os
import json
from datetime import datetime
from config import settings

# Store sent emails for testing
SENT_EMAILS = []

async def send_registration_email(user_email: str, user_name: str, event_title: str, qr_code_image: str):
    """Send registration confirmation email with QR code"""
    
    # If no SMTP configured, use enhanced mock mode
    if not settings.SMTP_USERNAME or settings.SMTP_USERNAME in ["your-email@gmail.com", "test@example.com"]:
        return await mock_send_email(user_email, user_name, event_title, qr_code_image)
    
    try:
        # Create message
        message = MIMEMultipart("related")
        message["From"] = settings.SMTP_USERNAME
        message["To"] = user_email
        message["Subject"] = f"Registration Confirmation - {event_title}"
        
        # Create HTML content
        html_content = f"""
        <html>
            <body>
                <h2>Event Registration Confirmation</h2>
                <p>Dear {user_name},</p>
                <p>Thank you for registering for <strong>{event_title}</strong>.</p>
                <p>Please find your QR code below which you'll need to present at the event:</p>
                <img src="cid:qrcode" alt="QR Code" style="display: block; margin: 20px auto;"/>
                <p>Keep this email safe and present the QR code at the event entrance.</p>
                <br>
                <p>Best regards,<br>Event Management Team</p>
            </body>
        </html>
        """
        
        # Attach HTML content
        message.attach(MIMEText(html_content, "html"))
        
        # Attach QR code image
        qr_data = base64.b64decode(qr_code_image)
        qr_image = MIMEImage(qr_data)
        qr_image.add_header('Content-ID', '<qrcode>')
        qr_image.add_header('Content-Disposition', 'inline', filename='qrcode.png')
        message.attach(qr_image)
        
        # Send email - SIMPLIFIED for Ethereal
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_SERVER,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=True,  # Ethereal requires TLS
        )
        print(f"✅ Email sent to {user_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        # Fall back to mock email
        return await mock_send_email(user_email, user_name, event_title, qr_code_image)

async def mock_send_email(user_email: str, user_name: str, event_title: str, qr_code_image: str):
    """Enhanced mock email function with better testing capabilities"""
    
    # Store email data for testing
    email_data = {
        "to": user_email,
        "user_name": user_name,
        "event_title": event_title,
        "qr_code_size": len(qr_code_image),
        "sent_at": datetime.now().isoformat(),
        "status": "sent (mock)"
    }
    
    SENT_EMAILS.append(email_data)
    
    # Save QR code to file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    qr_filename = f"qr_code_{timestamp}_{user_email.replace('@', '_at_')}.png"
    
    try:
        with open(qr_filename, "wb") as f:
            f.write(base64.b64decode(qr_code_image))
        email_data["qr_file"] = qr_filename
    except Exception as e:
        print(f"⚠️ Could not save QR code: {e}")
    
    # Enhanced console output
    print("=" * 70)
    print("📧 ENHANCED MOCK EMAIL SYSTEM")
    print("=" * 70)
    print(f"📍 To: {user_email}")
    print(f"👤 User: {user_name}")
    print(f"🎯 Event: {event_title}")
    print(f"📊 QR Code: {len(qr_code_image)} characters")
    print(f"💾 QR Saved: {qr_filename}")
    print(f"🕒 Sent at: {email_data['sent_at']}")
    print("=" * 70)
    
    # Also save to JSON file for persistence
    save_emails_to_json()
    
    return True

def save_emails_to_json():
    """Save sent emails to JSON file for testing"""
    try:
        with open("sent_emails.json", "w") as f:
            json.dump(SENT_EMAILS, f, indent=2)
    except Exception as e:
        print(f"⚠️ Could not save emails to JSON: {e}")

def get_sent_emails():
    """Get all sent emails for testing"""
    return SENT_EMAILS

def clear_sent_emails():
    """Clear sent emails list for testing"""
    global SENT_EMAILS
    SENT_EMAILS = []