"use client";

import { useEffect, useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { sapXepDanhMuc, type KetQuaAction } from "@/app/danh-muc/actions";
import { NutSuaMa, NutXoaMa } from "@/components/sua-ma";
import { Nhan, Td } from "@/components/ui";
import type { MaDTCP } from "@/lib/types";

export interface HangCay {
  ma: MaDTCP;
  con: boolean;
  soGiaoDich: number;
  soCon: number;
}

/**
 * Tính lại thứ tự sau khi kéo `src` thả lên `dst`.
 * - Mã CON: chỉ đổi thứ tự TRONG cùng mã cha (không rời nhóm).
 * - Mã CHA (nhóm/gốc): kéo cả KHỐI (cha + các con) tới vị trí cha đích, CÙNG loại.
 * Trả null nếu thao tác không hợp lệ.
 */
function xepLai(hang: HangCay[], src: number, dst: number): HangCay[] | null {
  const s = hang[src];
  const d = hang[dst];
  const cha = (h: HangCay) => h.ma.maCha;

  if (s.con) {
    if (!d.con || cha(d) !== cha(s)) return null; // con chỉ đổi trong nhóm cha
    const arr = hang.filter((_, k) => k !== src);
    const j = arr.findIndex((h) => h.ma.ma === d.ma.ma);
    arr.splice(src < dst ? j + 1 : j, 0, s);
    return arr;
  }

  // Cha: xác định cha đích (nếu thả lên một con thì lấy cha của con đó).
  const chaDich = d.con ? hang.find((h) => h.ma.ma === cha(d)) : d;
  if (!chaDich || chaDich.ma.loai !== s.ma.loai || chaDich.ma.ma === s.ma.ma) return null;

  // Khối nguồn = cha + các con liền sau nó.
  const khoi: HangCay[] = [s];
  for (let k = src + 1; k < hang.length && hang[k].con && cha(hang[k]) === s.ma.ma; k++) {
    khoi.push(hang[k]);
  }
  const conLai = hang.filter((h) => !khoi.includes(h));
  const di = conLai.findIndex((h) => h.ma.ma === chaDich.ma.ma);
  // Đếm số con của cha đích để chèn SAU cả khối khi kéo xuống.
  let soConDich = 0;
  for (let k = di + 1; k < conLai.length && conLai[k].con && cha(conLai[k]) === chaDich.ma.ma; k++) {
    soConDich++;
  }
  conLai.splice(src < dst ? di + 1 + soConDich : di, 0, ...khoi);
  return conLai;
}

/**
 * Thân bảng danh mục mã có KÉO-THẢ sắp xếp. Kéo mã nhóm sẽ mang theo các mã con;
 * mã con chỉ đổi thứ tự trong nhóm cha. Lưu ngay `thuTuHienThi` khi thả.
 */
export function CayMaKeo({
  hang: hangBanDau,
  duocSua,
}: {
  hang: HangCay[];
  /** Chỉ Quản trị mới kéo-sắp-xếp và có nút sửa/xoá; còn lại chỉ xem. */
  duocSua: boolean;
}) {
  const [hang, setHang] = useState(hangBanDau);
  const [keo, setKeo] = useState<number | null>(null);
  const [kq, setKq] = useState<KetQuaAction | null>(null);
  const [, batDau] = useTransition();

  // Sau khi server revalidate và trả props mới thì đồng bộ lại.
  useEffect(() => setHang(hangBanDau), [hangBanDau]);

  const tha = (dst: number) => {
    const src = keo;
    setKeo(null);
    if (src === null || src === dst) return;
    const moi = xepLai(hang, src, dst);
    if (!moi) {
      setKq({ ok: false, thongDiep: "Không thả được ở đó: mã con chỉ đổi trong nhóm, mã nhóm cùng loại." });
      return;
    }
    setHang(moi);
    const fd = new FormData();
    for (const h of moi) fd.append("ma", h.ma.ma);
    batDau(async () => setKq(await sapXepDanhMuc(fd)));
  };

  return (
    <tbody>
      {hang.map((h, i) => (
        <tr
          key={h.ma.ma}
          draggable={duocSua}
          onDragStart={duocSua ? () => setKeo(i) : undefined}
          onDragOver={duocSua ? (e) => e.preventDefault() : undefined}
          onDrop={duocSua ? () => tha(i) : undefined}
          className={`${h.con ? "hover:bg-nen" : "bg-nen/60 hover:bg-nen"} ${keo === i ? "opacity-40" : ""}`}
        >
          {duocSua ? (
            <Td className="px-2">
              <div className="flex flex-col items-center gap-0.5">
                <GripVertical className="size-3.5 cursor-grab text-chunhat" />
                <NutSuaMa ma={h.ma} soGiaoDich={h.soGiaoDich} />
                <NutXoaMa ma={h.ma} soGiaoDich={h.soGiaoDich} soCon={h.soCon} />
              </div>
            </Td>
          ) : null}
          <Td className={`text-xs ${h.con ? "pl-8" : "font-semibold"}`}>{h.ma.ma}</Td>
          <Td className={`text-xs ${h.con ? "" : "font-semibold"}`}>{h.ma.ten}</Td>
          <Td>
            <Nhan
              bienThe={h.ma.loai === "Doanh thu" ? "nhan" : h.ma.loai === "Giá trị thực hiện" ? "xanh" : "trung_tinh"}
            >
              {h.ma.loai}
            </Nhan>
          </Td>
          <Td className="text-xs text-chunhat">{h.ma.maCha ?? "—"}</Td>
          <Td>
            {h.ma.choPhepNhapTrucTiep ? (
              <Nhan bienThe="xanh">Có</Nhan>
            ) : (
              <Nhan>Không — mã nhóm</Nhan>
            )}
          </Td>
          <Td phai className="text-xs">
            {h.soGiaoDich > 0 ? h.soGiaoDich.toLocaleString("vi-VN") : <span className="text-chunhat">0</span>}
          </Td>
        </tr>
      ))}
      {kq ? (
        <tr>
          <td
            colSpan={duocSua ? 7 : 6}
            className={`px-3 py-1.5 text-xs ${kq.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {kq.thongDiep}
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}
