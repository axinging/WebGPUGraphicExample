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

export function createVertexBuffer(device, vertexArray) {
  // Create a vertex buffer from the cube data.
  const verticesBuffer1 = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(verticesBuffer1.getMappedRange()).set(vertexArray);
  verticesBuffer1.unmap();
  return verticesBuffer1;
}

export function createIndexBuffer(device, indexArray) {
  const indexBuffer1 = device.createBuffer({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer1.getMappedRange()).set(indexArray);
  indexBuffer1.unmap();
  return indexBuffer1;
}

export function createUniformBuffer(device) {
  const uniformBufferSize = 4 * 4;
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  return uniformBuffer;
}

export function createStorageBuffer(device) {
  const uniformBufferSize = 4 * 4;
  const storageBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
  });
  return storageBuffer;
}

export function createBindGroup(device, pipeline, uniformBuffer, uniformBufferSize = 16) {
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