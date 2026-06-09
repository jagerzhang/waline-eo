export function bufferSource(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

export function textBufferSource(text: string): Uint8Array<ArrayBuffer> {
  return bufferSource(new TextEncoder().encode(text));
}
