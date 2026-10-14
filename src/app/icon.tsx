import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 64, height: 64, background: "#172033", color: "#f6f1e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontFamily: "Georgia" }}>M</div>,
    size,
  );
}
