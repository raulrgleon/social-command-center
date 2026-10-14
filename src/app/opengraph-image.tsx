import { ImageResponse } from "next/og";

export const alt = "Mesa, centro de mando para redes sociales";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "#f3efe6", color: "#172033", padding: 72 }}>
      <div style={{ fontSize: 42 }}>Mesa</div>
      <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 900, marginTop: 16 }}>Cada red conserva su versión.</div>
    </div>,
    size,
  );
}
