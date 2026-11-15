# Enhance Prompt cho GitHub Copilot

**Mới trong 0.2.4:** lưu mức sử dụng Copilot dưới dạng dữ liệu kế toán cục bộ, không chứa prompt hay câu trả lời. Cập nhật Usage Insights lên **0.1.64**, khởi động lại Copilot, chạy một lần cải thiện rồi làm mới Usage Insights. Các phiên riêng biệt xuất hiện trong dự án **Enhanced Prompt**. Phí thiếu không được xem là miễn phí; không thể khôi phục biên nhận cũ đã bị xóa. [Vị trí lưu và giới hạn](../copilot-background-rewriting.md#usage-visibility).

**Mới trong 0.2.0:** trong Models, chọn cấu hình **GitHub Copilot** rồi chọn mô hình từ danh sách trực tiếp. Plugin viết lại ở chế độ nền bằng SDK và môi trường chạy có sẵn của ứng dụng, không cần npm, tải riêng hay khóa API. Mô hình Claude trong cấu hình này dùng tài khoản Copilot, không dùng Claude Code. Các cấu hình cũ được giữ nguyên; chọn cấu hình Copilot trong Enhance để sử dụng. [Chi tiết và giới hạn tương thích](../copilot-background-rewriting.md).

Viết lại yêu cầu thành prompt rõ ràng, dùng tệp, luật và thay đổi Git của dự án. Xem lại kết quả trong canvas rồi gửi vào phiên Copilot được kết nối.

Giữ lại trình soạn prompt, chuỗi model và dự phòng, luật, cấu trúc, lịch sử, tệp đính kèm và xem trước ngữ cảnh. Trong **Models**, thêm model API hoặc CLI có đăng ký. Plugin không dùng gói Copilot để trả phí cho model bên ngoài.

Canvas gửi tin nhắn mới, không gõ vào terminal. Phiên bận hoặc chờ trả lời sẽ từ chối gửi. Tự cải thiện mặc định tắt và có thể ảnh hưởng prompt nhập trong Copilot. API key lưu bằng DPAPI trên Windows; nền tảng khác chưa hỗ trợ lưu key.

Xem [hướng dẫn cài đặt và phát triển](../../README.md), [quyền riêng tư](../privacy.md) và [thay đổi](../changelog/CHANGELOG.vi.md).

Nên cài từ marketplace GitHub. Với bản cài trực tiếp từ thư mục, Copilot desktop 1.4.2 có thể hiển thị logo trong bảng nhưng thiếu logo trên tab. Xem [cách chuyển bản cài cục bộ sang GitHub](../../README.md#repair-an-existing-local-installation); chỉ mở phiên mới không khắc phục ổn định.

## Giấy phép và ghi nhận tác giả

Enhance Prompt được [cattfan](https://github.com/cattfan) tạo ra trong [dự án gốc](https://github.com/cattfan/orca-enhance-prompt). Bản fork này kế thừa thiết kế và phần triển khai của tác giả cùng những người đóng góp, rồi điều chỉnh cho GitHub Copilot.

Bản fork được phân phối theo [Giấy phép MIT](../../LICENSE), giữ nguyên toàn bộ giấy phép gốc và dòng `Copyright (c) 2026 cattfan`. Hãy kèm giấy phép này khi sao chép hoặc phân phối plugin, kể cả bản đã đóng gói.
