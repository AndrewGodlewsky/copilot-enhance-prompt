# Thay đổi

## [0.1.7] - 2026-11-14

### Sửa lỗi
- Chuyển sáng/tối ngay lập tức trên khung nhập yêu cầu, các điều khiển dùng chung và nút đóng thông báo, bỏ hiệu ứng đổi màu chậm hơn banner.

## [0.1.6] - 2026-11-14

### Mới
- Banner Quiet Desk với tên GitHub Copilot và hình minh họa tĩnh thay đổi theo giờ địa phương cùng trạng thái cải thiện hiện tại. Không có hoạt ảnh.
- Một nút chuyển sáng/tối ở góc trên bên phải. Lựa chọn được ghi nhớ giữa các canvas và phiên; trước khi bạn chọn, giao diện theo hệ thống.

### Thay đổi
- Chuyển phiên bản và liên kết ghi chú phát hành xuống chân trang, đặt bộ chọn ngôn ngữ cạnh thanh điều hướng.

## [0.1.5] - 2026-11-14

### Thay đổi
- Bỏ ghi đè biểu tượng canvas và sửa trực tiếp khai báo SDK không có tác dụng. Tab Copilot dùng SVG nhỏ gọn của plugin, cùng cơ chế với Usage Insights.
- Kiểm tra kích thước logo và plugin sở hữu canvas, thay vì coi đường dẫn biểu tượng trong SDK là bằng chứng hiển thị trên ứng dụng.
- Khuyến nghị cài từ marketplace GitHub có bản sao trong bộ nhớ đệm. Kiểm tra tiếp cho thấy bản cài trực tiếp từ thư mục thiếu logo trong siêu dữ liệu phiên của ứng dụng; đổi nguồn cài đã khôi phục đúng SVG trong chính các phiên đó. Chỉ mở phiên mới không khắc phục ổn định.

## [0.1.4] - 2026-11-14

### Thay đổi
- Dùng SVG nhỏ gọn làm biểu tượng plugin trong Copilot, theo cách khai báo của Usage Insights. Giữ PNG trong bảng điều khiển và siêu dữ liệu canvas của SDK. Biểu tượng trên tab ứng dụng vẫn cần được kiểm tra trực tiếp.

## [0.1.3] - 2026-11-14

### Sửa lỗi
- Đăng ký biểu tượng thương hiệu trực tiếp trên canvas để Copilot hiển thị trong tab. Giữ trường biểu tượng khi SDK đi kèm phiên bản cũ bỏ qua nó, và kiểm tra qua danh sách canvas cùng sự kiện mở tab.

## [0.1.2] - 2026-11-14

### Thay đổi
- Điều hướng có nhãn, các bước “Viết yêu cầu” / “Xem lại và gửi”, cùng các nút Cải thiện, Sao chép và Gửi tới Copilot rõ ràng.
- Chữ và nút lớn hơn; tùy chọn model/ngữ cảnh, trạng thái focus bàn phím, thanh cuộn và điều hướng bằng phím mũi tên dễ dùng hơn.
- Các mục Lịch sử, Model, Quy tắc và Cài đặt dễ đọc hơn; giải thích khi không thể gửi và khi chọn cải thiện rồi gửi không qua xem lại.
- Cập nhật giao diện tiếng Anh, Việt và Trung. Giữ nguyên phím tắt, kiểm tra quyền riêng tư và yêu cầu chủ động bật gửi tự động.

## [0.1.1] - 2026-11-14

### Thêm
- Biểu tượng prompt và tia sáng đơn sắc mới, được khai báo trong metadata plugin Copilot và hiển thị ở đầu canvas cùng favicon.

## [0.1.0] - 2026-11-14

### Thêm
- Canvas GitHub Copilot với trình soạn prompt, model, dự phòng, luật, cấu trúc, lịch sử, tệp đính kèm và xem trước ngữ cảnh.
- Gửi vào phiên được kết nối, truyền tải cục bộ có xác thực, lưu tùy chọn và bản nháp theo phiên, bảo vệ API key bằng Windows.
- Kiểm thử Node độc lập và bản build extension.

### Đổi
- Gửi tạo tin nhắn Copilot mới. Không gửi khi phiên bận, chờ trả lời, mất kết nối hoặc không rõ trạng thái.
- Tự cải thiện là hook tùy chọn, mặc định tắt; có thể thay đổi prompt bạn nhập trong Copilot.
- Các tính năng terminal, trình soạn thảo và thông báo chưa hỗ trợ được ghi rõ. Xuất tệp dùng tải xuống của trình duyệt.
- Đây là dòng phát hành đầu tiên của bản fork Copilot. Lịch sử trước đó còn trong Git.
