# Website quản lý nội dung — 28 Ngày Tán Đổ Guitar

Website có **4 cột chính: STT, Tên nội dung, Link video, Trạng thái quay** (Đã quay / Chưa quay). Ảnh bìa trong `assets/banner-28-ngay-guitar.webp` đã được lấy từ ảnh bạn gửi và cắt vừa khu vực banner. File `assets/banner-goc.jpg` lưu ảnh gốc để thay thế khi cần.

## 1. Có thể làm gì?

- **Người xem**: mở link website, xem danh sách, tiến độ quay, tìm kiếm, lọc nội dung theo Đã quay / Chưa quay hoặc có/chưa có link; xem video (YouTube, Google Drive, Vimeo, Loom có thể phát trong web; Facebook/TikTok thường cần mở trang gốc).
- **Sếp**: xem nội dung không cần đăng nhập. Để **tích Đã quay hoặc bỏ tích về Chưa quay**, sếp đăng nhập bằng tài khoản sếp được cấp quyền. Sếp **không được** thêm, sửa tên, đổi link hoặc xóa video. Quyền này được kiểm tra ở cơ sở dữ liệu, không chỉ ẩn nút trên giao diện.
- **Bạn / quản trị viên**: đăng nhập bằng email và mật khẩu, thêm nội dung, gắn link video, sửa/xóa nội dung và thay đổi thứ tự lên/xuống.
- Khi bạn lưu một nội dung, **mọi người mở website từ thiết bị khác sẽ nhận được dữ liệu mới** bằng Supabase Realtime; nếu mạng chặn realtime, website sẽ tự tải lại dữ liệu khoảng mỗi 20 giây. Người xem không phải đăng nhập.

> **QUAN TRỌNG:** GitHub Pages chỉ đăng tải mã web tĩnh, không lưu và chia sẻ các thay đổi do bạn nhập lên website. Vì vậy, để bạn gán link trên web rồi sếp thấy được, bạn phải kết nối **Supabase** theo mục 2. Khi chưa kết nối, web chạy ở **chế độ xem thử**, lưu nội dung vào `localStorage` *chỉ trên trình duyệt đang dùng*. Không gửi link demo cho sếp để mong được đồng bộ.

## 2. Thiết lập đồng bộ Supabase (chỉ làm lần đầu)

### Bước 1 — Tạo cơ sở dữ liệu

1. Vào https://supabase.com và tạo tài khoản.
2. Chọn **New Project**, đặt tên, chọn Region phù hợp, tạo mật khẩu cơ sở dữ liệu mạnh và chờ dự án khởi tạo.
3. Mở **SQL Editor → New query**.
4. Sao chép toàn bộ nội dung của file **`database.sql`** vào SQL Editor và bấm **Run**. Lệnh này tạo 3 bảng (`video_items`, `video_admins`, `video_reviewers`), cột `is_filmed`, một hàm SQL giới hạn quyền đánh dấu, phân quyền truy cập và bật Realtime. **Nếu dự án đã có Supabase từ bản trước**, chỉ cần chạy file `NANG-CAP-TRANG-THAI.sql` thay vì chạy lại toàn bộ.

### Bước 2 — Tạo tài khoản quản trị của bạn

1. Trong Supabase, mở **Authentication → Users → Add user → Create new user**.
2. Nhập email của bạn, đặt mật khẩu mạnh và tạo user (nếu giao diện có lựa chọn xác nhận email, hãy xác nhận/tạo user đã xác nhận để đăng nhập được).
3. Quay lại **SQL Editor**, chạy câu lệnh sau (thay email ví dụ bằng email bạn vừa tạo, viết chữ thường):

   ```sql
   insert into public.video_admins (email)
   values ('email-cua-ban@gmail.com')
   on conflict (email) do nothing;
   ```

   Để **chỉ mình bạn quản lý nội dung**, chỉ thêm **email của bạn** vào bảng `video_admins`; tuyệt đối không đưa email sếp vào bảng này.

### Bước 3 — Tạo tài khoản riêng cho sếp (chỉ đánh dấu trạng thái)

1. Vào **Authentication → Users → Add user** và tạo user/email + mật khẩu dành riêng cho sếp. Không dùng chung mật khẩu quản trị.
2. Mở **SQL Editor** và chạy câu lệnh sau, thay email sếp bằng email thật, chữ thường:

   ```sql
   insert into public.video_reviewers (email)
   values ('sep@example.com')
   on conflict (email) do nothing;
   ```

3. Sếp truy cập website, nhấn **Đăng nhập**, điền email và mật khẩu đó. Cột **Trạng thái quay** sẽ xuất hiện ô đánh dấu có thể thao tác: **tích = Đã quay**, **bỏ tích = Chưa quay**. Các thay đổi được lưu vào Supabase rồi tự đồng bộ cho bạn và mọi người.
4. Người xem thông thường không cần đăng nhập, sẽ thấy tình trạng quay nhưng không thể thay đổi. **Không cấp quyền `video_admins` cho sếp** nếu chỉ cần đánh dấu. Nếu email đã có trong cả hai bảng, quyền quản trị sẽ được ưu tiên.

> **Bảo mật:** Không nên cho khách truy cập ẩn danh tùy ý đánh dấu tiến độ, vì bất kỳ ai biết URL đều có thể sửa. Tài khoản sếp chỉ có quyền gọi hàm SQL để sửa `is_filmed`, còn thao tác quản trị khác được RLS từ chối.

### Bước 4 — Kết nối giao diện với Supabase

1. Mở **Project Settings → API** (hoặc **Connect** trong giao diện Supabase mới).
2. Lấy **Project URL** và **publishable key** hoặc **anon (public) key** của dự án.
3. Mở file **`config.js`**, thay hai chuỗi rỗng như sau:

   ```javascript
   window.APP_CONFIG = {
     SUPABASE_URL: "https://ten-du-an.supabase.co",
     SUPABASE_ANON_KEY: "sb_publishable_...",
     POLL_INTERVAL_MS: 20000
   };
   ```

4. Lưu file. **Không bao giờ đưa `service_role`, `secret key`, mật khẩu database hoặc mật khẩu đăng nhập vào source GitHub**. Publishable/anon key được thiết kế để dùng trong trình duyệt; quyền ghi dữ liệu do chính sách RLS trong `database.sql` kiểm soát.

### Bước 5 — Kiểm tra trước khi đăng lên GitHub

1. Mở website với một server cục bộ. Nếu bạn có Python, trong thư mục dự án chạy `python -m http.server 8000` rồi mở `http://localhost:8000`. Hoặc dùng VS Code với extension Live Server.
2. Xác nhận trạng thái **Đã kết nối** và danh sách ban đầu trống.
3. Bấm **Đăng nhập quản trị**, dùng email/mật khẩu ở Bước 2.
4. Bấm **Thêm nội dung**, điền tên video, dán link video, bấm lưu. Trạng thái mới mặc định là **Chưa quay**.
5. Mở web bằng cửa sổ ẩn danh: sẽ thấy nội dung và trạng thái nhưng không thể tích.
6. Mở một trình duyệt khác rồi đăng nhập tài khoản sếp: tích **Đã quay** ở một hàng. Kiểm tra trình duyệt quản trị và ẩn danh cũng thấy **Đã quay**. Bỏ tích để chuyển về **Chưa quay**.
7. Đảm bảo sếp không thấy nút **Thêm nội dung** hoặc các công cụ sửa/xóa.

### Quản lý kho dữ liệu về sau

- Vào **Supabase → Table Editor → `video_items`** để xem danh sách dữ liệu tập trung, kể cả khi truy cập bằng máy khác. Thông thường, bạn chỉ cần quản lý trực tiếp trên website sau khi đăng nhập quản trị.
- Vào **Authentication → Users** để tạo hoặc vô hiệu hóa tài khoản đăng nhập của bạn và sếp. Bảng `video_admins` dành riêng cho quyền chỉnh sửa nội dung, bảng `video_reviewers` dành cho quyền đánh dấu trạng thái.
- **Lưu ý:** Bộ ZIP chứa mã và SQL tạo kho lưu trữ; nó **không tự tạo tài khoản/dự án Supabase trên Internet**. Bạn cần thực hiện bước 2 trong tài khoản Supabase của bạn trước khi đồng bộ giữa các máy chạy được. Khi chưa kết nối, website sẽ hiện rõ **Bản xem thử**.

## 3. Đăng website lên GitHub Pages

1. Vào https://github.com, đăng nhập rồi chọn **New repository**. Ví dụ tên repo: `28-ngay-tan-do-guitar`.
2. Đặt repo là **Public**, chọn **Create repository**.
3. Trong repo chọn **Add file → Upload files**. Giải nén file ZIP được cung cấp rồi tải **toàn bộ nội dung bên trong thư mục `28-ngay-guitar-website`** lên root của repo: `index.html`, `styles.css`, `app.js`, `config.js`, `database.sql`, `HUONG-DAN.md` và cả thư mục `assets/`.
4. Chọn **Commit changes**.
5. Vào **Settings → Pages → Build and deployment**. Chọn **Deploy from a branch**, branch **main**, folder **/(root)**, bấm **Save**.
6. Sau khi GitHub Pages triển khai, link thường có dạng:

   `https://TEN-TAI-KHOAN.github.io/28-ngay-tan-do-guitar/`

7. Mở link đó để thử, sau đó gửi cho sếp. Bạn thêm/sửa link video trực tiếp trên website qua tài khoản quản trị; **không phải sửa source rồi upload lại GitHub** mỗi lần thêm video.

> Ghi chú: Nếu repository là Public và chính sách RLS cho phép xem công khai thì người có link đều xem được danh sách video. Không dùng website này cho video riêng tư/bí mật hoặc thông tin nhạy cảm. Các video YouTube/Drive có thể có quyền riêng tư riêng; người xem vẫn cần quyền truy cập video nguồn.

## 4. Các file cần biết

| File | Tác dụng |
|---|---|
| `index.html` | Giao diện website, bảng nội dung, các cửa sổ xem và chỉnh sửa |
| `styles.css` | Màu sắc, giao diện điện thoại/máy tính |
| `app.js` | Tìm kiếm, quản lý nội dung, đăng nhập, phát video, đồng bộ Supabase |
| `config.js` | Dán Project URL và publishable/anon key để kết nối |
| `database.sql` | Tạo đầy đủ bảng, hàm đánh dấu và phân quyền, bật Realtime |
| `NANG-CAP-TRANG-THAI.sql` | Chỉ chạy khi đã cài bản website cũ: thêm cột trạng thái, cấp quyền sếp mà không xóa dữ liệu cũ |
| `assets/` | Banner gốc, banner đã chỉnh tỉ lệ, biểu tượng favicon |
| `PROMPT-AI-STUDIO.txt` | Prompt để tiếp tục chỉnh giao diện bằng Google AI Studio |

## 5. Sử dụng mỗi ngày

- **Thêm**: Đăng nhập → **Thêm nội dung** → nhập tên và URL → **Thêm vào thư viện**.
- **Đổi link**: Nhấn nút cây bút tại hàng tương ứng → thay URL → **Lưu thay đổi**.
- **Đổi thứ tự**: Dùng mũi tên ↑/↓ ở cột Quản lý; cột STT sẽ đánh lại số tự động.
- **Xóa**: Nhấn biểu tượng thùng rác và xác nhận.
- **Đánh dấu quay (sếp hoặc admin)**: Vào cột **Trạng thái quay** → tích checkbox là **Đã quay**, bỏ tích là **Chưa quay**.
- **Lọc tiến độ**: Nhấn bộ lọc **Đã quay** hoặc **Chưa quay** để xem nhanh danh sách cần thực hiện. Phía trên có số lượng nội dung đã quay.
- **Chia sẻ**: Nhấn **Chia sẻ** ở góc trên (trên máy tính) để sao chép đường link.

## 6. Lỗi thường gặp

- **Vẫn hiện 'Bản xem thử'**: Chưa nhập cả 2 giá trị trong `config.js`, hoặc chưa upload bản `config.js` mới lên GitHub.
- **Báo lỗi đồng bộ / không tải được video**: Chưa chạy `database.sql`, cấu hình URL/key sai, hoặc dự án Supabase đang bị tạm dừng.
- **Đăng nhập được nhưng không có nút thêm**: Email đăng nhập chưa được thêm vào bảng `video_admins` (dùng toàn chữ thường), hoặc Auth user chưa được xác nhận.
- **Không mở được video**: Link nguồn không còn hiệu lực, nguồn giới hạn quyền xem, hoặc Facebook/TikTok không cho phép nhúng. Hãy dùng nút **Mở video gốc**.
- **Đã sửa ở bản xem thử nhưng sếp không thấy**: Đây là dữ liệu `localStorage`, chỉ lưu trên một trình duyệt; phải thiết lập Supabase rồi thêm nội dung trong chế độ **Đã kết nối**.
- **Không tự cập nhật ngay**: Hãy kiểm tra bảng `video_items` đã bật Realtime trong Database Publications; kể cả khi realtime không có, website sẽ kiểm tra lại mỗi 20 giây.

## 7. Nâng cấp từ bản website trước

Nếu bạn đã kết nối Supabase và có sẵn các nội dung, **không cần xóa database, không tạo lại video**. Mở SQL Editor, chạy toàn bộ file **`NANG-CAP-TRANG-THAI.sql`**, tạo user sếp trong Authentication, cấp email vào `video_reviewers`, rồi tải bản `index.html`, `app.js`, `styles.css` mới lên GitHub (giữ nguyên `config.js` cũ). Dữ liệu cũ được giữ lại; những video chưa có trạng thái sẽ mặc định là **Chưa quay**.

Nếu chưa từng kết nối Supabase, sử dụng `database.sql` đầy đủ theo mục 2. **Sếp không thể đồng bộ tích chọn chỉ bằng GitHub Pages**, luôn phải có cơ sở dữ liệu và tài khoản sếp.
