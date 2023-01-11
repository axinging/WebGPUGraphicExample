import {getDevice, presentationFormat} from './webgpu_util';
function getTextureShader() {
  const vertexShaderCode = `
    @vertex fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec4<f32>, 6>(
        vec4<f32>( 1.0,  1.0, 0.0, 1.0),
        vec4<f32>( 1.0, -1.0, 0.0, 1.0),
        vec4<f32>(-1.0, -1.0, 0.0, 1.0),
        vec4<f32>( 1.0,  1.0, 0.0, 1.0),
        vec4<f32>(-1.0, -1.0, 0.0, 1.0),
        vec4<f32>(-1.0,  1.0, 0.0, 1.0)
      );
      return pos[VertexIndex];
    }
      `;
  const fragmentShaderCode = `
    @group(0) @binding(0) var s : sampler;
    @group(0) @binding(1) var t : texture_external;
  
    @fragment fn main(@builtin(position) FragCoord : vec4<f32>)
                             -> @location(0) vec4<f32> {
        return textureSampleBaseClampToEdge(t, s, FragCoord.xy / vec2<f32>(640.0, 480.0));
    }
      `;
  return [vertexShaderCode, fragmentShaderCode];
}

export function drawTexture(device, swapChain, pipeline, video) {
  // const commandEncoder = device.createCommandEncoder();
  const bindGroup =
      createExternalTextureSamplingTestBindGroup(device, video, pipeline);
  const commandEncoder = device.createCommandEncoder();
  const textureView = swapChain.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [{
      view: textureView,
      loadValue: {r: 0.5, g: 0.5, b: 0.5, a: 1.0},
      loadOp: 'clear',
      storeOp: 'store',
    }]
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(6);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

export function createExternalTextureSamplingTestPipeline(device) {
  const [vertexShaderCode, fragmentShaderCode] = getTextureShader();
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: vertexShaderCode,
      }),
      entryPoint: 'main',
    },
    fragment: {
      module: device.createShaderModule({
        code: fragmentShaderCode,
      }),
      entryPoint: 'main',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {topology: 'triangle-list'},
  });

  return pipeline;
}

export function createExternalTextureSamplingTestBindGroup(
    device, source, pipeline) {
  const linearSampler = device.createSampler();
  const externalTexture = device.importExternalTexture({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    source: source,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: linearSampler,
      },
      {
        binding: 1,
        resource: externalTexture,
      },
    ],
  });

  return bindGroup;
}

export async function drawInit() {
    const [device, swapChain, presentationFormat] = await getDevice();
    const pipeline = createExternalTextureSamplingTestPipeline(device);
    return [device, swapChain, pipeline];
}