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