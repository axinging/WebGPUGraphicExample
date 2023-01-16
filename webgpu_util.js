export async function getDevice() {
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

// ? GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE
export function createBuffer(device, usage, size, array = null) {
  const mappedAtCreation = array ? true : false;
  const buffer = device.createBuffer({size, usage, mappedAtCreation});
  if (array instanceof Float32Array) {
    new Float32Array(buffer.getMappedRange()).set(array);
    buffer.unmap();
  } else if (array instanceof Uint32Array) {
    new Uint32Array(buffer.getMappedRange()).set(array);
    buffer.unmap();
  }
  return buffer;
}

export function createBindGroup(
    device, pipeline, uniformBuffer, uniformBufferSize = 16) {
  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
          offset: 0,
          size: uniformBufferSize,
        },
      },
    ],
  });
  return uniformBindGroup;
}
// TODO: Add buffer destroy.

export const presentationFormat = 'bgra8unorm';