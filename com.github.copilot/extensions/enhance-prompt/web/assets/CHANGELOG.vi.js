var e=`# Thay đổi

## [0.2.4] - 2026-11-14

### Bổ sung
- Lưu lâu dài số token và tín dụng AI do Copilot báo cáo trong nguồn kế toán cục bộ. Usage Insights 0.1.64 tự động phát hiện và nhóm các phiên nền riêng biệt trong dự án **Enhanced Prompt**, gồm kiểm tra mô hình và chọn tệp ở mức Max.
- Giữ mức sử dụng đã báo cáo khi lỗi hoặc hủy. Lỗi lưu được hiển thị trong Xem nhật ký, dừng dự phòng mô hình và giữ tệp phiên hỗ trợ để khôi phục. Không xuất prompt, câu trả lời, thông tin xác thực hay địa chỉ dịch vụ.
- Hướng dẫn cập nhật cả hai plugin, phân biệt phí thiếu hoặc một phần và giải thích rằng không thể khôi phục biên nhận cũ đã xóa. Kiểm chứng bằng mô hình cục bộ và trình đọc Usage Insights thật với dữ liệu giả lập.

## [0.2.3] - 2026-11-14

### Sửa lỗi
- Sửa việc khám phá mô hình Copilot và Làm mới bị chặn khi ứng dụng khởi chạy điểm vào tích hợp \`extension_bootstrap.mjs\`. Nhận diện đúng tên này cùng đường dẫn tuyệt đối của SDK, vẫn giữ kiểm tra tệp thực thi, SDK và tiến trình cha.
- Thêm cờ chẩn đoán an toàn \`bootstrapEmbedded\` và kiểm thử hồi quy bằng môi trường chạy đã cài cho cả hai cách khởi chạy. Kiểm thử dùng danh sách mô hình giả lập, không gửi yêu cầu đến mô hình trả phí.

## [0.2.2] - 2026-11-14

### Thay đổi
- Phân biệt lỗi xác minh môi trường Copilot, tải SDK, lấy danh sách và danh sách không có mô hình phù hợp. Làm mới thử lại danh sách trực tiếp, không tải thành phần hay gọi mô hình.
- Thêm phần **Khám phá mô hình Copilot** vào Xem nhật ký và báo cáo sao chép: kiểm tra môi trường/API, bước lỗi, mã lỗi an toàn và số lượng mô hình qua bộ lọc. Không chứa đường dẫn, ID mô hình, thông tin tài khoản hay lỗi nguyên văn.
- Ghi nhận thao tác làm mới và việc bị chặn bởi quyền riêng tư. Vô hiệu hóa chọn mô hình Copilot và Lưu khi danh sách chưa có hoặc đang tải.

## [0.2.1] - 2026-11-14

### Thêm
- Chân trang liên kết đến kho mã, Cài đặt, nhật ký chẩn đoán và biểu mẫu tạo issue trên GitHub. Phiên bản hiển thị màu xám, không phải liên kết; ghi chú phát hành vẫn tự mở một lần sau khi cập nhật.
- Nhật ký hỗ trợ có thể sao chép, gồm thời gian, kết quả thao tác, thời lượng, mã lỗi và bước Copilot gặp lỗi. Nhật ký được giới hạn trong bộ nhớ, không chứa lời nhắc, nội dung tệp, đường dẫn, tên tài khoản hay khóa API; không tự động tải lên.
- Vẫn xem được chẩn đoán của bảng điều khiển khi không kết nối được tiến trình xử lý; có thể chọn văn bản để sao chép nếu không truy cập được bảng nhớ tạm.

## [0.2.0] - 2026-11-14

### Thêm
- Cấu hình GitHub Copilot với danh sách mô hình theo tài khoản và viết lại ở chế độ nền bằng SDK/môi trường chạy có sẵn của ứng dụng. Người dùng không cần npm, tải môi trường chạy riêng hay khóa API.
- Phiên hỗ trợ tạm thời kiểm tra tài khoản và mô hình, không có công cụ hay tự đọc dự án, hỗ trợ hủy và dọn dữ liệu. Dự phòng và chọn file ở mức Max luôn dùng Copilot khi chọn Copilot.

### Thay đổi
- Biểu mẫu mô hình mới mặc định là GitHub Copilot. Giữ nguyên các cấu hình đã lưu; API và CLI thuê bao vẫn là lựa chọn riêng.
- Cập nhật hướng dẫn cài đặt, phí Copilot, đăng nhập và giới hạn tương thích. Không dùng phiên Copilot nền cho hook chat tự động có giới hạn hai giây.

## [0.1.8] - 2026-11-14

### Thay đổi
- Thay biểu tượng dấu nhắc và tia sáng bằng bong bóng hội thoại Lift màu xanh lá với mũi tên hướng lên. Giữ SVG nhỏ gọn cho siêu dữ liệu plugin Copilot và favicon PNG đồng bộ.

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
`;export{e as default};