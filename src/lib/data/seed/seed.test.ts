/**
 * Test bất biến của bộ dữ liệu demo.
 *
 * Đây là tiêu chí nghiệm thu §17.2: "Tổng theo mã khớp Excel chuẩn".
 * Nếu test này đỏ thì mọi con số trên dashboard đều không đáng tin.
 */
import { describe, expect, it } from "vitest";
import { taoBoDuLieu } from "./index";
import { bienLoiNhuan, danhGiaSucKhoe } from "../../kpi";

const db = taoBoDuLieu();

describe("Bất biến: sổ chính thức khớp ma trận OUTPUT_NAM", () => {
  it("tổng theo (mã × công trình) khớp TUYỆT ĐỐI từng ô", () => {
    const thucTe = new Map<string, number>();
    for (const g of db.giaoDich) {
      const k = `${g.maDTCP}|${g.maCongTrinh}`;
      thucTe.set(k, (thucTe.get(k) ?? 0) + g.soTien);
    }

    const lech: string[] = [];
    for (const o of db.maTranGoc) {
      const k = `${o.maCode}|${o.maCongTrinh}`;
      const got = thucTe.get(k) ?? 0;
      if (got !== o.giaTri) lech.push(`${k}: mong đợi ${o.giaTri}, nhận ${got}`);
    }

    expect(lech).toEqual([]);
  });

  it("không sinh thừa tổ hợp (mã × công trình) ngoài ma trận gốc", () => {
    const hopLe = new Set(db.maTranGoc.map((o) => `${o.maCode}|${o.maCongTrinh}`));
    const thua = new Set<string>();
    for (const g of db.giaoDich) {
      const k = `${g.maDTCP}|${g.maCongTrinh}`;
      if (!hopLe.has(k)) thua.add(k);
    }
    expect([...thua]).toEqual([]);
  });

  it("tổng toàn bộ sổ khớp tổng ma trận gốc", () => {
    const tongSo = db.giaoDich.reduce((a, g) => a + g.soTien, 0);
    const tongGoc = db.maTranGoc.reduce((a, o) => a + o.giaTri, 0);
    expect(tongSo).toBe(tongGoc);
  });
});

describe("Toàn vẹn sổ chính thức", () => {
  it("mọi giao dịch chính thức đều đủ trường bắt buộc", () => {
    for (const g of db.giaoDich) {
      expect(g.maCongTrinh, `gd ${g.id} thiếu mã công trình`).toBeTruthy();
      expect(g.thangThucHien, `gd ${g.id} thiếu tháng thực hiện`).toBeTruthy();
      expect(g.maDTCP, `gd ${g.id} thiếu mã DT–CP`).toBeTruthy();
      expect(g.noiDungThanhToan.trim().length, `gd ${g.id} thiếu nội dung`).toBeGreaterThan(0);
      expect(Number.isFinite(g.soTien)).toBe(true);
    }
  });

  it("mọi mã dùng trong sổ đều tồn tại trong danh mục 55 mã", () => {
    const hopLe = new Set(db.danhMucMa.map((c) => c.ma));
    const la = [...new Set(db.giaoDich.map((g) => g.maDTCP))].filter((m) => !hopLe.has(m!));
    expect(la).toEqual([]);
  });

  it("chỉ ghi vào mã cho phép nhập trực tiếp (§3.4)", () => {
    const khongChoNhap = new Set(
      db.danhMucMa.filter((c) => !c.choPhepNhapTrucTiep).map((c) => c.ma)
    );
    const viPham = [...new Set(db.giaoDich.map((g) => g.maDTCP))].filter((m) =>
      khongChoNhap.has(m!)
    );
    expect(viPham).toEqual([]);
  });

  it("Đơn giá × Số lượng = Số tiền khi có đủ ba trường", () => {
    for (const g of db.giaoDich) {
      if (g.donGia !== null && g.soLuong !== null) {
        expect(g.donGia * g.soLuong, `gd ${g.id} sai tích đơn giá × số lượng`).toBe(g.soTien);
      }
    }
  });

  it("dòng LỖI nằm ngoài sổ chính thức (§17.1)", () => {
    const idSo = new Set(db.giaoDich.map((g) => g.id));
    for (const g of db.giaoDichChoXuLy) {
      expect(idSo.has(g.id)).toBe(false);
      expect(g.trangThai).toBe("LOI");
    }
    expect(db.giaoDichChoXuLy.length).toBeGreaterThan(0);
    expect(db.loiDuLieu.length).toBeGreaterThan(0);
  });
});

describe("Tính lặp lại", () => {
  it("chạy hai lần cho kết quả giống hệt", () => {
    const lai = taoBoDuLieu();
    expect(lai.giaoDich.length).toBe(db.giaoDich.length);
    expect(lai.giaoDich.reduce((a, g) => a + g.soTien, 0)).toBe(
      db.giaoDich.reduce((a, g) => a + g.soTien, 0)
    );
    expect(lai.giaoDich[0].rowHash).toBe(db.giaoDich[0].rowHash);
  });
});

describe("Công thức KPI (§21)", () => {
  it("biên lợi nhuận trả null khi doanh thu = 0, không phải 0", () => {
    expect(bienLoiNhuan(0, 500)).toBeNull();
    expect(bienLoiNhuan(1000, 900)).toBeCloseTo(0.1, 10);
  });

  it("lợi nhuận âm luôn cho sức khỏe Đỏ", () => {
    const r = danhGiaSucKhoe({
      doanhThu: 1_000,
      chiPhi: 1_500,
      cpKeHoach: 5_000,
      dtKeHoach: 5_000,
      ngayCapNhatCuoi: "2026-07-19",
      bienLNMucTieu: 0.15,
      soLoiDuLieu: 0,
    });
    expect(r.sucKhoe).toBe("Đỏ");
    expect(r.lyDo.join(" ")).toContain("âm");
  });

  it("mọi chỉ số tốt thì cho sức khỏe Xanh", () => {
    const r = danhGiaSucKhoe({
      doanhThu: 10_000,
      chiPhi: 5_000,
      cpKeHoach: 10_000,
      dtKeHoach: 10_000,
      ngayCapNhatCuoi: "2026-07-19",
      bienLNMucTieu: 0.15,
      soLoiDuLieu: 0,
    });
    expect(r.sucKhoe).toBe("Xanh");
  });
});

describe("Kế hoạch và ánh xạ hệ mã", () => {
  it("mã DA11 chưa ánh xạ được -> maDTCP null, bị loại khỏi KPI", () => {
    const da11 = db.anhXaMa.find((a) => a.maCu === "DA11");
    expect(da11?.maMoi).toBeNull();
  });

  it("không ánh xạ nào bị 'duyệt sẵn' — Tài chính phải rà tay", () => {
    expect(db.anhXaMa.every((a) => a.daDuyet === false)).toBe(true);
  });

  it("TDA2 hệ cũ KHÔNG được map về TDA2 hệ mới (trùng ký hiệu khác nghĩa)", () => {
    const tda2 = db.anhXaMa.find((a) => a.maCu === "TDA2");
    expect(tda2?.maMoi).not.toBe("TDA2");
  });

  it("có sinh dòng kế hoạch cho công trình có phát sinh", () => {
    expect(db.keHoach.length).toBeGreaterThan(0);
    expect(db.keHoach.every((k) => k.giaTri >= 0)).toBe(true);
  });
});
