"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Bang, Nhan, Td, Th } from "@/components/ui";
import { phanTram, tien } from "@/lib/format";

export interface DongCP {
  ma: string;
  ten: string;
  soTien: number;
  tyTrongTrenCP: number;
  tyTrongTrenDT: number | null;
  /** Biến động so kỳ trước. null = không có kỳ trước hoặc mã mới phát sinh. */
  bienDong: number | null;
  /** Vượt ngưỡng tỷ trọng — chỉ đánh dấu ở mã chi tiết. */
  vuotNguong: boolean;
}

export interface NhomCP extends DongCP {
  con: DongCP[];
}

function OBienDong({ bd }: { bd: number | null }) {
  if (bd === null) return <span className="text-chunhat">mới</span>;
  return (
    <span
      className={
        bd > 0.3
          ? "text-rose-600 dark:text-rose-400"
          : bd < 0
            ? "text-emerald-700 dark:text-emerald-400"
            : ""
      }
    >
      {bd > 0 ? "+" : ""}
      {phanTram(bd)}
    </span>
  );
}

/**
 * Bảng tỷ trọng chi phí dạng cây: nhóm chi phí mở ra thành các mã chi tiết.
 *
 * Mặc định THU hết cho bảng gọn — người xem cần bức tranh nhóm trước, chi tiết
 * chỉ mở ở nhóm đang quan tâm. Mã không có mã cha thì bản thân nó là một nhóm
 * không có con, nên không hiện mũi tên.
 */
export function CayChiPhi({
  nhom,
  coBienDong,
  tongChiPhi,
  tyTrongTrenDTTong,
}: {
  nhom: NhomCP[];
  coBienDong: boolean;
  tongChiPhi: number;
  tyTrongTrenDTTong: number | null;
}) {
  const [mo, setMo] = useState<Record<string, boolean>>({});
  const coCon = nhom.filter((n) => n.con.length);
  const dangMoHet = coCon.length > 0 && coCon.every((n) => mo[n.ma]);

  const doiTatCa = () =>
    setMo(dangMoHet ? {} : Object.fromEntries(coCon.map((n) => [n.ma, true])));

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-xs text-chunhat">
          {nhom.length} nhóm · {nhom.reduce((a, n) => a + n.con.length, 0)} mã chi tiết
        </p>
        {coCon.length ? (
          <button
            type="button"
            onClick={doiTatCa}
            className="rounded-md border border-vien px-2.5 py-1 text-xs font-medium"
          >
            {dangMoHet ? "Thu tất cả" : "Mở tất cả"}
          </button>
        ) : null}
      </div>

      <Bang>
        <thead>
          <tr>
            <Th>Mã</Th>
            <Th>Hạng mục</Th>
            <Th phai>Số tiền</Th>
            <Th phai>% tổng CP</Th>
            <Th phai>% trên DT</Th>
            {coBienDong ? <Th phai>Biến động</Th> : null}
          </tr>
        </thead>
        <tbody>
          {nhom.map((n) => {
            const dangMo = !!mo[n.ma];
            return (
              <Fragment key={n.ma}>
                <tr
                  className={`bg-nen/60 hover:bg-nen ${n.con.length ? "cursor-pointer" : ""}`}
                  onClick={n.con.length ? () => setMo({ ...mo, [n.ma]: !dangMo }) : undefined}
                >
                  <Td className="text-xs font-semibold whitespace-nowrap">
                    {n.con.length ? (
                      dangMo ? (
                        <ChevronDown className="mr-1 inline size-3" />
                      ) : (
                        <ChevronRight className="mr-1 inline size-3" />
                      )
                    ) : (
                      <span className="mr-1 inline-block w-3" />
                    )}
                    {n.ma}
                  </Td>
                  <Td className="max-w-[280px] truncate text-xs font-semibold" title={n.ten}>
                    {n.ten}
                    {n.con.length ? (
                      <span className="ml-1.5 font-normal text-chunhat">({n.con.length} mã)</span>
                    ) : null}
                  </Td>
                  <Td phai className="font-semibold">
                    {tien(n.soTien)}
                  </Td>
                  <Td phai>{phanTram(n.tyTrongTrenCP)}</Td>
                  <Td phai>{phanTram(n.tyTrongTrenDT)}</Td>
                  {coBienDong ? (
                    <Td phai>
                      <OBienDong bd={n.bienDong} />
                    </Td>
                  ) : null}
                </tr>

                {dangMo
                  ? n.con.map((c) => (
                      <tr key={c.ma} className="hover:bg-nen">
                        <Td className="pl-8 text-xs whitespace-nowrap">{c.ma}</Td>
                        <Td className="max-w-[280px] truncate text-xs" title={c.ten}>
                          {c.ten}
                        </Td>
                        <Td phai>{tien(c.soTien)}</Td>
                        <Td phai>
                          {c.vuotNguong ? (
                            <Nhan bienThe="vang">{phanTram(c.tyTrongTrenCP)}</Nhan>
                          ) : (
                            phanTram(c.tyTrongTrenCP)
                          )}
                        </Td>
                        <Td phai>{phanTram(c.tyTrongTrenDT)}</Td>
                        {coBienDong ? (
                          <Td phai>
                            <OBienDong bd={c.bienDong} />
                          </Td>
                        ) : null}
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}

          <tr className="bg-nen font-semibold">
            <Td colSpan={2}>TỔNG CHI PHÍ</Td>
            <Td phai>{tien(tongChiPhi)}</Td>
            <Td phai>100,0%</Td>
            <Td phai>{phanTram(tyTrongTrenDTTong)}</Td>
            {coBienDong ? <Td /> : null}
          </tr>
        </tbody>
      </Bang>
    </>
  );
}
