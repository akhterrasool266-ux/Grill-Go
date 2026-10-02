import QRCode from 'qrcode';

/** Server-rendered QR code (SVG). The payload is plain text we control, e.g. a student ID. */
export async function QrSvg({ value, size = 96, className }: { value: string; size?: number; className?: string }) {
  const svg = await QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  return <div className={className} style={{ width: size, height: size }} role="img" aria-label={`QR code ${value}`} dangerouslySetInnerHTML={{ __html: svg.replace('<svg', '<svg width="100%" height="100%"') }} />;
}
