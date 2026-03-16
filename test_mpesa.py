import urllib.request
import base64
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Auth payload
url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
key = "nBmLvdWI8Hs8L0Mx1jvttkCq4tcs7wmBdYkRDBGX5X2ve9RW"
secret = "mCneDHOXPHRCe9llIYzOr9c6yw9EGrAiWkl8jXBDUYTljqyA6XUozw2UHHdX8Gi0"

auth_str = f"{key}:{secret}"
auth_bytes = auth_str.encode('ascii')
base64_bytes = base64.b64encode(auth_bytes)
base64_auth = base64_bytes.decode('ascii')

req = urllib.request.Request(url)
req.add_header('Authorization', f'Basic {base64_auth}')

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode())
        access_token = data['access_token']
        
        # 2. QR payload
        qr_url = "https://sandbox.safaricom.co.ke/mpesa/qrcode/v1/generate"
        payload = {
            "MerchantName": "Ratibu Chama",
            "RefNo": "Payment",
            "Amount": 1,
            "TrxCode": "PB",
            "CPI": "174379",
            "Size": "300"
        }
        
        payload_bytes = json.dumps(payload).encode('utf-8')
        qr_req = urllib.request.Request(qr_url, data=payload_bytes, method="POST")
        qr_req.add_header('Authorization', f'Bearer {access_token}')
        qr_req.add_header('Content-Type', 'application/json')
        
        try:
            with urllib.request.urlopen(qr_req, context=ctx) as qr_res:
                print(qr_res.read().decode())
        except urllib.error.HTTPError as e:
            print(f"QR Error: {e.code} - {e.read().decode()}")

except Exception as e:
    print(f"Error: {e}")
