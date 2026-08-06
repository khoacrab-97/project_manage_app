/**
 * Chặn sớm khi KHÔNG CÓ cookie phiên, và báo đường dẫn hiện tại xuống layout.
 *
 * Proxy không truy vấn cơ sở dữ liệu, tức là
 * KHÔNG kiểm tra được cookie còn hiệu lực hay không. Vì vậy nó chỉ là lớp chặn thứ
 * nhất; lớp bắt buộc thật nằm ở `src/app/layout.tsx` — nơi gọi `nguoiDungHienTai()`
 * để đối chiếu token với cơ sở dữ liệu.
 *
 * Layout không tự biết đường dẫn, nên proxy gắn vào header `x-duong-dan` để
 * layout biết có đang ở trang đăng nhập hay không mà miễn trừ.
 */
import { NextResponse, type NextRequest } from "next/server";

const CONG_KHAI = ["/dang-nhap"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const header = new Headers(request.headers);
  header.set("x-duong-dan", pathname + search);
  const diTiep = NextResponse.next({ request: { headers: header } });

  if (CONG_KHAI.some((p) => pathname.startsWith(p))) return diTiep;

  if (!request.cookies.get("prmana_phien")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = "";
    // Nhớ trang đang muốn vào để đăng nhập xong quay lại đúng chỗ.
    if (pathname !== "/") url.searchParams.set("tiep", pathname + search);
    return NextResponse.redirect(url);
  }

  return diTiep;
}

export const config = {
  // Bỏ qua tài nguyên tĩnh và ảnh; API vẫn phải qua kiểm tra.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
