export function renderSize(width: number, height: number, deviceRatio: number) {
  const w = Math.max(1, Math.round(width)),
    h = Math.max(1, Math.round(height));
  // Match retina displays while bounding the GPU buffer on large monitors.
  const density = Math.max(
    1,
    Math.min(
      Number.isFinite(deviceRatio) ? deviceRatio : 1,
      3,
      Math.sqrt(4_194_304 / (w * h)),
    ),
  );
  return {
    width: w,
    height: h,
    density,
    bufferWidth: Math.round(w * density),
    bufferHeight: Math.round(h * density),
  };
}
