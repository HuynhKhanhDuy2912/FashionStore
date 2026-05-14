# Hướng dẫn tích hợp thanh toán

## 1. VNPay (Thanh toán nội địa Việt Nam)

### Đăng ký tài khoản Sandbox
1. Truy cập: https://sandbox.vnpayment.vn/devreg/
2. Đăng ký tài khoản doanh nghiệp test
3. Sau khi đăng ký, bạn sẽ nhận được:
   - `vnp_TmnCode`: Mã website
   - `vnp_HashSecret`: Secret key

### Cấu hình .env
```env
VNP_TMN_CODE=<your_tmn_code>
VNP_HASH_SECRET=<your_hash_secret>
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:3000/payment/vnpay/callback
```

### Test thanh toán
- Số thẻ test: 9704198526191432198
- Tên chủ thẻ: NGUYEN VAN A
- Ngày phát hành: 07/15
- Mật khẩu OTP: 123456

---

## 2. MoMo (Ví điện tử)

### Đăng ký tài khoản Test
1. Liên hệ MoMo Business: https://business.momo.vn/
2. Yêu cầu tài khoản test environment
3. Nhận thông tin:
   - `PARTNER_CODE`
   - `ACCESS_KEY`
   - `SECRET_KEY`

### Cấu hình .env
```env
MOMO_PARTNER_CODE=<your_partner_code>
MOMO_ACCESS_KEY=<your_access_key>
MOMO_SECRET_KEY=<your_secret_key>
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REDIRECT_URL=http://localhost:3000/payment/momo/callback
MOMO_IPN_URL=http://localhost:5000/api/payment/momo/ipn
```

### Test thanh toán
- Tải app MoMo
- Đăng ký tài khoản test
- Nạp tiền test từ MoMo Business Portal

---

## 3. PayPal (Thanh toán quốc tế)

### Đăng ký tài khoản Sandbox
1. Truy cập: https://developer.paypal.com/
2. Đăng nhập hoặc tạo tài khoản
3. Vào Dashboard > Apps & Credentials
4. Tạo App mới, chọn Sandbox
5. Copy Client ID và Secret

### Cấu hình .env
```env
PAYPAL_CLIENT_ID=<your_client_id>
PAYPAL_CLIENT_SECRET=<your_client_secret>
PAYPAL_MODE=sandbox
PAYPAL_RETURN_URL=http://localhost:3000/payment/paypal/callback
PAYPAL_CANCEL_URL=http://localhost:3000/checkout
```

### Test thanh toán
1. Vào Dashboard > Sandbox > Accounts
2. Tạo Personal Account (buyer)
3. Sử dụng email/password test để thanh toán

**Tài khoản test mẫu:**
- Email: sb-buyer@personal.example.com
- Password: (xem trong PayPal Dashboard)

---

## API Endpoints

### VNPay
- **POST** `/api/payment/vnpay/create` - Tạo URL thanh toán
- **GET** `/api/payment/vnpay/callback` - Callback sau thanh toán

### MoMo
- **POST** `/api/payment/momo/create` - Tạo thanh toán
- **GET** `/api/payment/momo/callback` - Callback
- **POST** `/api/payment/momo/ipn` - Webhook

### PayPal
- **POST** `/api/payment/paypal/create` - Tạo order
- **GET** `/api/payment/paypal/callback` - Callback

---

## Cách sử dụng trong Frontend

```javascript
// Tạo thanh toán VNPay
const response = await apiRequest("/payment/vnpay/create", {
  method: "POST",
  token,
  body: { orderId, amount }
});
window.location.href = response.data.paymentUrl;

// Tạo thanh toán MoMo
const response = await apiRequest("/payment/momo/create", {
  method: "POST",
  token,
  body: { orderId, amount }
});
window.location.href = response.data.paymentUrl;

// Tạo thanh toán PayPal
const response = await apiRequest("/payment/paypal/create", {
  method: "POST",
  token,
  body: { orderId, amount }
});
window.location.href = response.data.paymentUrl;
```

---

## Lưu ý quan trọng

1. **VNPay**: Chỉ hỗ trợ VND, số tiền phải là số nguyên
2. **MoMo**: Chỉ hỗ trợ VND, cần IPN URL public để nhận webhook
3. **PayPal**: Hỗ trợ USD, cần convert từ VND (tỷ giá ~25,000 VND/USD)
4. **Callback URL**: Phải là URL public khi deploy production
5. **IPN/Webhook**: Cần domain public hoặc dùng ngrok để test local

---

## Chuyển sang Production

1. Đăng ký tài khoản production
2. Cập nhật credentials trong `.env`
3. Đổi URL từ sandbox sang production:
   - VNPay: `https://vnpayment.vn/paymentv2/vpcpay.html`
   - MoMo: `https://payment.momo.vn/v2/gateway/api/create`
   - PayPal: `PAYPAL_MODE=live`
4. Cập nhật callback URLs với domain thật
