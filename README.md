# interview_platform

Nền tảng luyện phỏng vấn xây dựng bằng Next.js, React và TypeScript, sử dụng Firebase cho đăng nhập/lưu trữ và Gemini để tạo câu hỏi phỏng vấn. Giao diện hiện mang tên PrepWise.

## Chức năng hiện có

- Đăng ký, đăng nhập bằng email/mật khẩu và session cookie Firebase.
- Giao diện danh sách phỏng vấn với dữ liệu mẫu.
- API tạo câu hỏi bằng Gemini và lưu vào collection `Interview` trong Firestore.
- Giao diện cuộc gọi phỏng vấn đang dùng trạng thái và hội thoại mẫu; chưa kết nối cuộc gọi Vapi hoặc chấm điểm thực tế. Các trang chi tiết phỏng vấn và feedback chưa được triển khai.

## Chạy trên máy

Yêu cầu Node.js 22.x và npm. Phiên bản Node được khai báo trong `package.json` để Vercel dùng cùng phiên bản major với môi trường đã kiểm tra.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

Điền cấu hình thực tế trong `.env.local` trước khi chạy server. Nếu đã có file này, giữ nguyên cấu hình đang dùng. Trên macOS/Linux, dùng `npm` và `cp .env.example .env.local`.

```powershell
npm.cmd run dev
```

Mở `http://localhost:3000`. Trang chính yêu cầu đăng nhập.

## Cấu hình

| Biến môi trường | Nội dung |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Project ID của Firebase, không có dấu phẩy ở cuối |
| `FIREBASE_CLIENT_EMAIL` | Email service account của Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | Private key của service account, đặt trong dấu ngoặc kép và giữ ký tự `\n` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API key Gemini |
| `NEXT_PUBLIC_VAPI_WEB_TOKEN` | Public web token Vapi |

Bật phương thức đăng nhập Email/Password và tạo Firestore trong Firebase project. Cấu hình Firebase phía trình duyệt nằm trong `firebase/client.ts`; khi dùng Firebase project khác, cập nhật cấu hình này cho khớp với service account.

`.env.local` được Git bỏ qua; `.env.example` chỉ chứa giá trị mẫu. Khởi động lại server sau khi thay đổi cấu hình Firebase Admin.

## Test API bằng Thunder Client

Gửi `POST http://localhost:3000/api/vapi/generate`, chọn Body → JSON và header `Content-Type: application/json`:

```json
{
  "type": "technical",
  "role": "Frontend Developer",
  "level": "junior",
  "techstack": "React,TypeScript",
  "amount": 3,
  "userid": "YOUR_FIREBASE_USER_UID"
}
```

`userid` phải viết thường và `techstack` là chuỗi phân cách bằng dấu phẩy. Khi thành công, API trả `{"success":true}` và lưu một bản ghi vào Firestore. Model hiện được chọn trong `app/api/vapi/generate/route.ts`.

`GET /api/vapi/generate` chỉ trả phản hồi kiểm tra route; không kiểm tra kết nối Gemini hay Firestore.

## Kiểm tra và build

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd start
```

Build cần cấu hình Firebase hợp lệ và kết nối mạng để tải font Google.

Bản production dùng `next build --webpack` để nạp Firebase Admin qua tên package gốc, tránh phụ thuộc vào alias `firebase-admin-<hash>` của Turbopack trong bản deploy. Lệnh `npm run dev` vẫn dùng Turbopack.

## Deploy trên Vercel

Import repository, dùng lệnh build `npm run build` và điền các biến môi trường thực tế trong **Settings → Environment Variables** cho môi trường Production/Preview tương ứng. File `.env.local` trên máy không nằm trong repository.

Trong ô Value của `FIREBASE_PRIVATE_KEY`, chỉ dán nội dung khóa PEM có đầy đủ header/footer, không kèm `FIREBASE_PRIVATE_KEY=`, dấu ngoặc kép bao quanh hoặc dấu phẩy. Code hỗ trợ xuống dòng thật và ký tự `\n`. Dấu ngoặc kép trong `.env.example` là cú pháp của file `.env`, không phải một phần của khóa.

Sau khi đổi biến môi trường, tạo deployment mới. Khi đổi cách build để xử lý lỗi module, redeploy với **Use existing Build Cache** tắt để kiểm tra bản build mới.

## Cấu trúc chính

- `app/(auth)`: trang đăng ký và đăng nhập.
- `app/(root)`: trang chính và giao diện phỏng vấn.
- `app/api/vapi/generate`: API tạo câu hỏi.
- `components`: giao diện và các thành phần dùng chung.
- `firebase`: cấu hình Firebase client và Admin.
- `lib/actions`: server actions xử lý tài khoản và session.
- `lib/vapi.sdk.ts`: khởi tạo Vapi SDK.
