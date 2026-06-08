const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function utf8ToBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

export function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1];
    const byte3 = bytes[index + 2];

    const triplet = (byte1 << 16) | ((byte2 ?? 0) << 8) | (byte3 ?? 0);
    output += BASE64_CHARS[(triplet >> 18) & 63];
    output += BASE64_CHARS[(triplet >> 12) & 63];
    output += byte2 === undefined ? "=" : BASE64_CHARS[(triplet >> 6) & 63];
    output += byte3 === undefined ? "=" : BASE64_CHARS[triplet & 63];
  }
  return output;
}

export function base64ToBytes(value: string) {
  const normalized = value.replace(/[\n\r\s=]/g, "");
  const outputLength = Math.floor((normalized.length * 3) / 4);
  const output = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const char of normalized) {
    const code = BASE64_CHARS.indexOf(char);
    if (code < 0) {
      throw new Error("Base64 invalide");
    }
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }

  return output.slice(0, index);
}
