"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ngay, nhanThang, so, tien } from "@/lib/format";
import { Bang, CanhBaoBox, Nhan, Rong, Td, The, TheDau, Th } from "@/components/ui";

interface KetQuaAPI {
  tenFile: string;
  kichThuoc: number;
  nguon: "table" | "sheet";
  tenSheet: string;
  cotTimThay: string[];
  cotThieu: string[];
  cotBoQua: string[];
  tomTat: {
    tongDong: number;
    dongCoSoTien: number;
    dongHopLe: number;
    dongLoi: number;
    soError: number;
    soWarning: number;
  };
  loiCauTruc: { maLoi: string; mucDo: string; thongDiep: string }[];
  loi: {
    dongExcel: number;
    cot: string | null;
    maLoi: string;
    mucDo: string;
    thongDiep: string;
    cachXuLy: string;
  }[];
  tongSoLoi: number;
  dong: {
    dongExcel: number;
    maCongTrinh: string | null;
    soHoaDon: string | null;
    ngayChungTu: string | null;
    thangThucHien: string | null;
    noiDungThanhToan: string | null;
    soTien: number | null;
    maDTCP: string | null;
  }[];
}

const BUOC = ["Tải file", "Kiểm tra cấu trúc", "Xem trước & lỗi", "Ghi sổ"];

export function ImportWizard() {
  const [dangChay, setDangChay] = useState(false);
  const [kq, setKq] = useState<KetQuaAPI | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [keo, setKeo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buocHienTai = kq ? (kq.tomTat.soError > 0 ? 2 : 3) : dangChay ? 1 : 0;

  async function guiFile(file: File) {
    setDangChay(true);
    setLoi(null);
    setKq(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/kiem-tra-file", { method: "POST", body: fd });
      const data = await res.json();
      // `loiXuLy` = lỗi chí mạng (chuỗi); `loi` = danh sách lỗi theo dòng (mảng).
      if (!res.ok) setLoi(data.loiXuLy ?? "Không xử lý được file.");
      else setKq(data as KetQuaAPI);
    } catch {
      setLoi("Không gửi được file lên máy chủ.");
    } finally {
      setDangChay(false);
    }
  }

  return (
    <>
      {/* ---- Thanh bước ---- */}
      <ol className="mb-4 flex flex-wrap gap-2">
        {BUOC.map((b, i) => {
          const xong = i < buocHienTai;
          const dang = i === buocHienTai;
          return (
            <li
              key={b}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
                dang
                  ? "border-nhan bg-nhannhat text-nhan"
                  : xong
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-vien bg-the text-chunhat"
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full text-[10px]",
                  xong ? "bg-emerald-600 text-white" : dang ? "bg-nhan text-white" : "bg-vien"
                )}
              >
                {xong ? <Check className="size-2.5" /> : i + 1}
              </span>
              {b}
            </li>
          );
        })}
      </ol>

      {/* ---- Vùng thả file ---- */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setKeo(true);
        }}
        onDragLeave={() => setKeo(false)}
        onDrop={(e) => {
          e.preventDefault();
          setKeo(false);
          const f = e.dataTransfer.files?.[0];
          if (f) guiFile(f);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          keo ? "border-nhan bg-nhannhat" : "border-vien bg-the"
        )}
      >
        <FileUp className="mx-auto size-7 text-chunhat" />
        <p className="mt-2 text-sm font-medium">Kéo thả file công trình vào đây</p>
        <p className="mt-1 text-xs text-chunhat">
          File <code>.xlsx</code> có Table <code>tbl_ChiTietTH</code> hoặc sheet{" "}
          <code>2.1 CHI TIẾT TH</code>. Tối đa 25 MB.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={dangChay}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          {dangChay ? "Đang kiểm tra…" : "Chọn file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) guiFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {loi ? (
        <div className="mt-4">
          <CanhBaoBox bienThe="do" tieuDe="Không xử lý được file">
            {loi}
          </CanhBaoBox>
        </div>
      ) : null}

      {kq ? <KetQua kq={kq} /> : null}
    </>
  );
}

function KetQua({ kq }: { kq: KetQuaAPI }) {
  const coError = kq.tomTat.soError > 0;
  const loiTheoMa = new Map<string, { mucDo: string; thongDiep: string; cachXuLy: string; dong: number[] }>();
  for (const l of kq.loi) {
    const o = loiTheoMa.get(l.maLoi) ?? {
      mucDo: l.mucDo,
      thongDiep: l.thongDiep,
      cachXuLy: l.cachXuLy,
      dong: [],
    };
    o.dong.push(l.dongExcel);
    loiTheoMa.set(l.maLoi, o);
  }

  return (
    <div className="mt-5 space-y-4">
      {/* ---- Bước 2: cấu trúc ---- */}
      <The>
        <TheDau
          tieuDe="Kết quả kiểm tra cấu trúc"
          moTa={`${kq.tenFile} · ${(kq.kichThuoc / 1024).toFixed(0)} KB`}
          phai={
            <Nhan bienThe={kq.nguon === "table" ? "xanh" : "vang"}>
              {kq.nguon === "table" ? `Đọc từ Table` : `Đọc từ sheet "${kq.tenSheet}"`}
            </Nhan>
          }
        />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Chi so={kq.tomTat.tongDong} nhan="Dòng đọc được" />
          <Chi so={kq.tomTat.dongCoSoTien} nhan="Dòng có số tiền" />
          <Chi so={kq.cotTimThay.length} nhan="Cột chuẩn nhận được" phu="/ 15" />
          <Chi so={kq.cotBoQua.length} nhan="Cột thừa bị bỏ qua" />
        </div>

        {kq.loiCauTruc.length ? (
          <ul className="space-y-2 border-t border-vien px-4 py-3">
            {kq.loiCauTruc.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Nhan bienThe={l.mucDo === "Error" ? "do" : l.mucDo === "Warning" ? "vang" : "nhan"}>
                  {l.mucDo}
                </Nhan>
                <span className="text-chunhat">{l.thongDiep}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </The>

      {/* ---- Bước 3: lỗi ---- */}
      <The>
        <TheDau
          tieuDe="Lỗi dữ liệu"
          moTa={`${kq.tomTat.soError} lỗi chặn (Error) · ${kq.tomTat.soWarning} cảnh báo (Warning) trên ${so(kq.tomTat.tongDong)} dòng`}
          phai={
            <Nhan bienThe={coError ? "do" : kq.tomTat.soWarning ? "vang" : "xanh"}>
              {coError ? "Không được ghi sổ" : kq.tomTat.soWarning ? "Ghi sổ có giải trình" : "Sạch"}
            </Nhan>
          }
        />
        {loiTheoMa.size ? (
          <Bang>
            <thead>
              <tr>
                <Th>Mức</Th>
                <Th>Mã lỗi</Th>
                <Th>Mô tả</Th>
                <Th phai>Số dòng</Th>
                <Th>Dòng trong file</Th>
                <Th>Cách xử lý</Th>
              </tr>
            </thead>
            <tbody>
              {[...loiTheoMa.entries()]
                .sort((a, b) => (a[1].mucDo === "Error" ? -1 : 1) - (b[1].mucDo === "Error" ? -1 : 1))
                .map(([ma, l]) => (
                  <tr key={ma} className="hover:bg-nen">
                    <Td>
                      <Nhan bienThe={l.mucDo === "Error" ? "do" : "vang"}>{l.mucDo}</Nhan>
                    </Td>
                    <Td className="text-xs">{ma}</Td>
                    <Td className="max-w-75 text-xs">{l.thongDiep}</Td>
                    <Td phai>{l.dong.length}</Td>
                    <Td className="max-w-45 truncate text-[11px] text-chunhat">
                      {l.dong.slice(0, 12).join(", ")}
                      {l.dong.length > 12 ? "…" : ""}
                    </Td>
                    <Td className="max-w-65 text-xs text-chunhat">{l.cachXuLy}</Td>
                  </tr>
                ))}
            </tbody>
          </Bang>
        ) : (
          <Rong>Không phát hiện lỗi nào</Rong>
        )}
      </The>

      {/* ---- Xem trước dữ liệu ---- */}
      <The>
        <TheDau
          tieuDe="Xem trước dữ liệu đã chuẩn hóa"
          moTa={`${Math.min(200, kq.dong.length)} dòng đầu, sau khi quy đổi ngày tháng và số tiền`}
        />
        {kq.dong.length ? (
          <Bang>
            <thead>
              <tr>
                <Th phai>Dòng</Th>
                <Th>Mã công trình</Th>
                <Th>Số HĐ</Th>
                <Th>Ngày CT</Th>
                <Th>Tháng TH</Th>
                <Th>Nội dung</Th>
                <Th phai>Số tiền</Th>
                <Th>Mã DT–CP</Th>
              </tr>
            </thead>
            <tbody>
              {kq.dong.map((d) => (
                <tr key={d.dongExcel} className="hover:bg-nen">
                  <Td phai className="text-xs text-chunhat">
                    {d.dongExcel}
                  </Td>
                  <Td className="text-xs">{d.maCongTrinh ?? <Thieu />}</Td>
                  <Td className="text-xs">{d.soHoaDon ?? <Thieu />}</Td>
                  <Td className="text-xs whitespace-nowrap">
                    {d.ngayChungTu ? ngay(d.ngayChungTu) : <Thieu />}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    {d.thangThucHien ? nhanThang(d.thangThucHien) : <Thieu />}
                  </Td>
                  <Td className="max-w-65 truncate text-xs" title={d.noiDungThanhToan ?? ""}>
                    {d.noiDungThanhToan ?? <Thieu />}
                  </Td>
                  <Td phai>{d.soTien !== null ? tien(d.soTien) : <Thieu />}</Td>
                  <Td className="text-xs">{d.maDTCP ?? <Thieu />}</Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        ) : (
          <Rong>File không có dòng dữ liệu nào</Rong>
        )}
      </The>

      {/* ---- Bước 4: ghi sổ ---- */}
      <The>
        <TheDau tieuDe="Ghi vào sổ chính thức" />
        <div className="p-4">
          {coError ? (
            <CanhBaoBox bienThe="do" tieuDe="Chưa thể ghi sổ">
              File còn {kq.tomTat.soError} lỗi mức Error. Theo §17.1, dữ liệu Error không được ghi
              vào sổ chính thức. Sửa file nguồn rồi tải lại.
            </CanhBaoBox>
          ) : (
            <CanhBaoBox bienThe="nhan" tieuDe="File đủ điều kiện chuyển sang phê duyệt">
              Ở bản chính thức, bấm nút này sẽ tạo lô nhập, chuyển cho QLDA kiểm tra rồi Tài chính
              xác nhận trước khi ghi sổ (§8.7). Bản mẫu này dừng ở bước kiểm tra — chưa có cơ sở dữ
              liệu để ghi.
            </CanhBaoBox>
          )}
          <button
            type="button"
            disabled
            className="mt-3 cursor-not-allowed rounded-lg bg-nhan px-4 py-2 text-xs font-medium text-white opacity-50"
            title="Chức năng ghi sổ thuộc Phase 2"
          >
            Gửi phê duyệt và ghi sổ
          </button>
        </div>
      </The>
    </div>
  );
}

function Chi({ so: n, nhan, phu }: { so: number; nhan: string; phu?: string }) {
  return (
    <div>
      <p className="so text-xl font-semibold">
        {n.toLocaleString("vi-VN")}
        {phu ? <span className="text-sm font-normal text-chunhat">{phu}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-chunhat">{nhan}</p>
    </div>
  );
}

function Thieu() {
  return (
    <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
      <X className="size-3" /> trống
    </span>
  );
}
