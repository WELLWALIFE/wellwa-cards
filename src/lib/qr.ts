import QRCode from "qrcode";

/** Generate a QR code as a data URL (PNG). Runs on the server. */
export async function qrDataUrl(text: string, color = "#131a22"): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 480,
    margin: 1,
    color: { dark: color, light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
