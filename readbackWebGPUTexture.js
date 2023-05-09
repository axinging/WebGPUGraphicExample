'use strict';
const kPixelValue = 0x66;
const kPixelValueFloat = 0x66 / 0xff;
async function getDevice() {
  if (!navigator.gpu) {
    alert(
        `WebGPU is not supported. Please use Chrome Canary browser with flag --enable-unsafe-webgpu enabled.`);
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const canvas = document.getElementById('canvas')
  const swapChain = canvas.getContext('webgpu');

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  swapChain.configure({
    device,
    format: presentationFormat,
    alphaMode: 'opaque',
  });
  return [device, swapChain, presentationFormat];
}

function writePixelsToWebGPUCanvas(canvas, device) {
  const format = 'bgra8unorm';
  const alphaMode = 'opaque';
  const ctx = canvas.getContext('webgpu');

  ctx.configure({
    device: device,
    format,
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    alphaMode,
  });

  const canvasTexture = ctx.getCurrentTexture();
  const tempTexture = device.createTexture({
    size: {width: 1, height: 1, depthOrArrayLayers: 1},
    format,
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_DST,
  });
  const tempTextureView = tempTexture.createView();
  const encoder = device.createCommandEncoder();

  const clearOnePixel = (origin, color) => {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: tempTextureView,
          clearValue: color,
          loadOp: 'clear',
          storeOp: 'store'
        },
      ],
    });
    pass.end();
    encoder.copyTextureToTexture(
        {texture: tempTexture}, {texture: canvasTexture, origin},
        {width: 1, height: 1});
  };

  clearOnePixel([0, 0], [0, 0, kPixelValueFloat, kPixelValueFloat]);
  clearOnePixel([1, 0], [0, kPixelValueFloat, 0, kPixelValueFloat]);
  clearOnePixel([0, 1], [kPixelValueFloat, 0, 0, kPixelValueFloat]);
  clearOnePixel(
      [1, 1], [kPixelValueFloat, kPixelValueFloat, 0, kPixelValueFloat]);

  device.queue.submit([encoder.finish()]);
  tempTexture.destroy();

  return canvas;
}

async function readPixelsFromWebGPUCanvas(webgpuCanvas) {
  const snapshot = await createImageBitmap(webgpuCanvas);
  const canvas = new OffscreenCanvas(2, 2);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(snapshot, 0, 0);
  return new Uint8ClampedArray(
      ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data);
}

async function main() {
  const canvas = document.getElementById('canvas');
  const [device, swapChain, presentationFormat] = await getDevice();
  writePixelsToWebGPUCanvas(canvas, device);

  console.log(await readPixelsFromWebGPUCanvas(canvas));
}
