# interview_platform

Nền tảng luyện phỏng vấn bằng Next.js, React và TypeScript. Firebase phụ trách đăng nhập, session và lưu dữ liệu; Gemini tạo câu hỏi và chấm feedback; Vapi thực hiện cuộc gọi giọng nói.

## Chức năng

- Đăng ký và đăng nhập bằng Firebase Email/Password.
- Tạo bộ câu hỏi phỏng vấn bằng giọng nói.
- Thực hiện cuộc phỏng vấn với Vapi Assistant.
- Lưu transcript và tạo feedback có cấu trúc bằng Gemini.
- Xem lại điểm, nhận xét, điểm mạnh và phần cần cải thiện.

## Chạy trên máy

Yêu cầu Node.js 22.x và npm.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Mở `http://localhost:3000`. Điền các biến môi trường thật vào `.env.local` trước khi chạy.

## Biến môi trường

| Biến | Nội dung |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Project ID của Firebase Admin |
| `FIREBASE_CLIENT_EMAIL` | Email của Firebase service account |
| `FIREBASE_PRIVATE_KEY` | Private key PEM, dùng `\n` khi lưu trên một dòng |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API key Gemini |
| `GOOGLE_GENERATIVE_AI_MODEL` | Model Gemini tùy chọn; mặc định `gemini-3.6-flash` |
| `NEXT_PUBLIC_VAPI_WEB_TOKEN` | Public web token của Vapi |

Trong Vapi Dashboard, public key phải cho phép **Transient Assistants** và thêm `http://localhost:3000` cùng domain Vercel vào **Allowed Origins**. Dự án không dùng Vapi Workflows.

Bật phương thức đăng nhập Email/Password và tạo Firestore trong Firebase project. Cấu hình trình duyệt tại `firebase/client.ts` phải trỏ cùng project với service account Firebase Admin.

## API tạo interview

`POST /api/vapi/generate` yêu cầu session đăng nhập hợp lệ. UID được lấy từ session trên server; client không được gửi `userid`.

Body:

```json
{
  "type": "technical",
  "role": "Frontend Developer",
  "level": "junior",
  "techstack": "React,TypeScript",
  "amount": 3
}
```

Luồng bình thường gọi API này từ Vapi tool trong ứng dụng. Nếu dùng Thunder Client, cần gửi kèm cookie `session` của một tài khoản đã đăng nhập.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd run build
```

## Firestore

Các index nằm trong `firestore.indexes.json`. Nếu dùng Firebase CLI:

```powershell
firebase deploy --only firestore:indexes,firestore:rules
```

Rules hiện chỉ cho phép truy cập dữ liệu qua server Firebase Admin. Nếu thêm truy cập Firestore trực tiếp từ trình duyệt, cập nhật rules và kiểm thử bằng Emulator trước khi deploy.

## Deploy Vercel

Import repository, dùng lệnh build `npm run build`, rồi cấu hình đầy đủ biến môi trường cho Production và Preview.

Trong Value của `FIREBASE_PRIVATE_KEY`, dán đúng khóa PEM có header/footer. Không kèm tên biến, dấu phẩy hoặc dấu ngoặc kép bao quanh. Code hỗ trợ cả xuống dòng thật và chuỗi `\n`.

Sau khi thay đổi biến môi trường hoặc dependency, redeploy và tắt **Use existing Build Cache** nếu deployment cũ vẫn báo lỗi module.
