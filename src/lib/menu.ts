/**
 * Danh sách mục điều hướng — NGUỒN DUY NHẤT.
 *
 * Thanh menu, màn hình phân quyền và chốt chặn phía máy chủ đều đọc từ đây, nên
 * thêm một trang mới chỉ cần khai báo một chỗ.
 *
 * Biểu tượng KHÔNG để ở đây: chúng là component của lucide-react, để trong file
 * này sẽ kéo cả thư viện đó vào phía máy chủ. Biểu tượng nằm ở `sidebar.tsx`.
 */
export interface MucMenu {
  id: string;
  nhan: string;
  href: string;
}

export const MENU: MucMenu[] = [
  { id: "tong-quan", nhan: "Tổng quan", href: "/" },
  { id: "cong-trinh", nhan: "Công trình", href: "/cong-trinh" },
  { id: "chi-phi", nhan: "Cơ cấu chi phí", href: "/chi-phi" },
  { id: "dong-tien", nhan: "Dòng tiền", href: "/dong-tien" },
  { id: "ke-hoach", nhan: "Kế hoạch – Ngân sách", href: "/ke-hoach" },
  { id: "cong-nhan", nhan: "Quản lý công nhân", href: "/cong-nhan" },
  { id: "nhap-du-lieu", nhan: "Nhập dữ liệu", href: "/nhap-du-lieu" },
  { id: "kiem-tra-du-lieu", nhan: "Kiểm tra dữ liệu", href: "/kiem-tra-du-lieu" },
  { id: "danh-muc", nhan: "Danh mục mã", href: "/danh-muc" },
];

/**
 * Tra mục menu tương ứng với một đường dẫn.
 * Khớp tiền tố để `/cong-trinh/HL-00240` cũng thuộc mục "Công trình".
 * Trả `undefined` với đường dẫn không thuộc menu nào (ví dụ `/quan-tri/...`,
 * `/dang-nhap`) — những trang đó có cơ chế chặn riêng.
 */
export function timMucMenu(duongDan: string): MucMenu | undefined {
  const sach = duongDan.split("?")[0];
  if (sach === "/") return MENU[0];
  // Duyệt từ href dài nhất để không khớp nhầm với "/".
  return [...MENU]
    .filter((m) => m.href !== "/")
    .sort((a, b) => b.href.length - a.href.length)
    .find((m) => sach === m.href || sach.startsWith(`${m.href}/`));
}

/**
 * Tiêu đề trang hiển thị trên thanh trên cùng (in hoa bằng CSS). Là nguồn DUY NHẤT
 * cho tiêu đề mỗi hạng mục — các trang không tự vẽ tiêu đề nữa. Trang chi tiết công
 * trình không có ở đây: thanh trên hiện nút quay lại "← Danh mục công trình".
 */
export const TIEU_DE_TRANG: Record<string, string> = {
  "/": "Tổng quan điều hành",
  "/cong-trinh": "Danh mục công trình",
  "/chi-phi": "Cơ cấu chi phí tất cả công trình",
  "/dong-tien": "Dòng tiền",
  "/ke-hoach": "Kế hoạch – Ngân sách",
  "/cong-nhan": "Quản lý công nhân",
  "/nhap-du-lieu": "Nhập dữ liệu từ file công trình",
  "/kiem-tra-du-lieu": "Chất lượng dữ liệu",
  "/danh-muc": "Danh mục mã doanh thu – chi phí",
  "/quan-tri/nguoi-dung": "Quản trị người dùng",
};

export function tieuDeTrang(duongDan: string): string | undefined {
  return TIEU_DE_TRANG[duongDan.split("?")[0]];
}
