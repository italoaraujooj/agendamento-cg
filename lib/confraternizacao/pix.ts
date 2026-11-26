/**
 * PIX estático (BR Code / EMV-QRCPS) com valor fixo.
 *
 * Gera o texto do "copia e cola", que também é o conteúdo do QR Code.
 * Referência: Manual de Padrões para Iniciação do Pix (Banco Central).
 */

import type { PixReceiver } from "./config"

function field(id: string, value: string) {
  const len = value.length
  if (len > 99) throw new Error(`Campo PIX ${id} longo demais (${len})`)
  return `${id}${String(len).padStart(2, "0")}${value}`
}

/** Remove acentos e caracteres fora do conjunto aceito pelos bancos. */
function sanitize(value: string, max: number) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-@]/g, "")
    .trim()
    .slice(0, max)
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), em hexadecimal maiúsculo. */
export function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export function pixPayload(
  receiver: PixReceiver,
  amount: number,
  options: { txid?: string; description?: string } = {}
) {
  const base = field("00", "br.gov.bcb.pix") + field("01", receiver.key)
  const withDescription = options.description
    ? base + field("02", sanitize(options.description, 40))
    : base
  // O campo 26 tem no máximo 99 caracteres: com chave longa, a descrição sai
  const account = withDescription.length <= 99 ? withDescription : base

  const txid = (options.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***"

  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (amount > 0 ? field("54", amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", sanitize(receiver.name, 25)) +
    field("60", sanitize(receiver.city, 15)) +
    field("62", field("05", txid)) +
    "6304"

  return payload + crc16(payload)
}
