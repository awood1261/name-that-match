import QRCode from 'qrcode';

export async function contestantQr(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function withDisplayOrigin(link: string, origin: string): string {
  const target = new URL(origin); const source = new URL(link);
  target.pathname = source.pathname; target.hash = source.hash;
  return target.href;
}
