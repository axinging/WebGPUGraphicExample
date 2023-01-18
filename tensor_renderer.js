import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-webgpu';

import * as tf from '@tensorflow/tfjs-core';

function createBuffer(device, usage, size, array = null) {
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

// TODO: Add buffer destroy.

export const presentationFormat = 'bgra8unorm';

function getQuadShader() {
  const vertexShaderCode = `
  struct Uniforms {
    x : f32,
    y : f32,
    width : f32,
    height : f32,
  }
  
  @binding(0) @group(0) var<uniform> uniforms : Uniforms;
  @binding(1) @group(0) var<storage> uniformsTensor : Uniforms;
  @vertex
  fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec4<f32>,
    @location(1) uv : vec2<f32>
  ) -> @builtin(position) vec4<f32> {
      let positionOut = vec4<f32>(position.x + uniforms.x + uniformsTensor.x, position.y * 1.8, position.z, position.w);
      return positionOut;
  }
    `;
  const fragmentShaderCode = `
  @fragment
  fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
  }
    `;
  return [vertexShaderCode, fragmentShaderCode];
}

let frameIndex = 0;
export function drawQuad(device, swapChain, bindGroup, pipeline) {
  const commandEncoder = device.createCommandEncoder();
  const textureView = swapChain.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [{
      view: textureView,
      loadValue: {r: 0.5, g: 0.5, b: 0.5, a: 1.0},
      loadOp: 'load',
      storeOp: 'store',
    }]
  };

  const uniformData =
      new Float32Array([0.1 * frameIndex % 3, 0.1 * frameIndex % 3, 1, 1]);
  frameIndex++;
  device.queue.writeBuffer(
      uniformBuffer, 0, uniformData.buffer, uniformData.byteOffset,
      uniformData.byteLength);

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, verticesBuffer);
  passEncoder.setIndexBuffer(indexBuffer, 'uint32');
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.drawIndexed(8);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

function getTensorBuffer() {
  const data = [0.2, 0.2, 1, 1];
  const dataB = [0, 0, 0, 0];
  const size = 48;
  tf.env().set('WEBGPU_CPU_FORWARD', false);
  const a = tf.tensor(data, [4], 'float32');
  const b = tf.tensor(dataB, [4], 'float32');
  const c = tf.add(a, b);
  const res = c.dataToGPU();
  return res.buffer;
}


const TENSOR_UNIFORM_SIZE = 16;

let indexBuffer;
let verticesBuffer;
let uniformBuffer;
export function drawQuadInit(device) {
  const quadVertexArray = new Float32Array([
    // float4 position, float4 color, float2 uv,
    0.5,  0.5,  1, 1, 1, 0, 1, 1, 1, 1, -0.5, 0.5,  1, 1, 0, 0, 1, 1, 0, 1,
    -0.5, -0.5, 1, 1, 1, 0, 1, 1, 1, 1, 0.5,  -0.5, 1, 1, 0, 0, 0, 1, 0, 0,
  ]);

  const quadIndexArray = new Uint32Array([
    // float4 position, float4 color, float2 uv,
    0, 1, 1, 2, 2, 3, 3, 0
  ]);

  // Create a vertex buffer from the quad data.
  // TODO: handle buffer destroy.
  verticesBuffer = createBuffer(
      device, GPUBufferUsage.VERTEX, quadVertexArray.byteLength,
      quadVertexArray);
  indexBuffer = createBuffer(
      device, GPUBufferUsage.INDEX, quadIndexArray.byteLength, quadIndexArray);
  uniformBuffer = createBuffer(
      device, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      TENSOR_UNIFORM_SIZE);
  const tensorBuffer = getTensorBuffer();

  const quadVertexSize = 4 * 10;  // Byte size of one quad vertex.
  const quadPositionOffset = 0;
  const quadUVOffset = 4 * 8;

  const [vertexShaderCode, fragmentShaderCode] = getQuadShader();
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({code: vertexShaderCode}),
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: quadVertexSize,
          attributes: [
            {
              // position
              shaderLocation: 0,
              offset: quadPositionOffset,
              format: 'float32x4',
            },
            {
              // uv
              shaderLocation: 1,
              offset: quadUVOffset,
              format: 'float32x2',
            },
          ],
        },
      ]
    },
    fragment: {
      module: device.createShaderModule({code: fragmentShaderCode}),
      entryPoint: 'main',
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: {
      topology: 'line-list',
    }
  });
  const bindings = [
    {
      buffer: uniformBuffer,
      offset: 0,
      size: TENSOR_UNIFORM_SIZE,
    },
    {
      buffer: tensorBuffer,
      offset: 0,
      size: TENSOR_UNIFORM_SIZE,
    }
  ];
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: bindings.map((b, i) => ({binding: i, resource: b})),
  });
  return [bindGroup, pipeline];
}


export async function getDevice(canvasNode) {
  await tf.setBackend('webgpu');
  await tf.ready();
  const device = tf.backend().device;

  const canvas = document.getElementById(canvasNode)
  const swapChain = canvas.getContext('webgpu');

  swapChain.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: 'opaque',
  });
  return [device, swapChain];
}


function getExternalTextureShader() {
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

export function drawTexture(device, swapChain, texturePipeline, video) {
  const textureBindGroup =
      createExternalTextureBindGroup(device, video, texturePipeline);
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

  passEncoder.setPipeline(texturePipeline);
  passEncoder.setBindGroup(0, textureBindGroup);
  passEncoder.draw(6);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

function createExternalTexturePipeline(device) {
  const [vertexShaderCode, fragmentShaderCode] = getExternalTextureShader();
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

export function drawTextureInit(device, video) {
  const pipeline = createExternalTexturePipeline(device);
  return pipeline;
}

function createExternalTextureBindGroup(device, source, pipeline) {
  const linearSampler = device.createSampler();
  const externalTexture = device.importExternalTexture({
    source,
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

// TODO: test.
export function dispose() {
  indexBuffer.destroy();
  verticesBuffer.destroy();
  uniformBuffer.destroy();
}

/*
let rafId;
let camera;
async function renderResult(device, swapChain, pipeline, quadBindGroup,
quadPipeline) { if (camera.video.readyState < 2) { await new Promise((resolve)
=> { camera.video.onloadeddata = () => { resolve(video);
      };
    });
  }
  drawTexture(device, swapChain, pipeline, camera.video);
  drawQuad(device, swapChain, quadBindGroup, quadPipeline);
}

async function renderPrediction(device, swapChain, pipeline, quadBindGroup,
quadPipeline) { await renderResult(device, swapChain, pipeline, quadBindGroup,
quadPipeline);
  // rafId = requestAnimationFrame(renderPrediction);

  rafId = requestAnimationFrame(function() {
    renderPrediction(device, swapChain, pipeline, quadBindGroup, quadPipeline);
  });
};

async function app() {
  const [device, swapChain, pipeline] = await getDevice();
  //const device = device1;
  // swapChain = swapChain;
  // pipeline = pipeline1;

  // Gui content will change depending on which model is in the query string.
  const config = {sizeOption: '640 X 480', targetFPS: 60};
  camera = await Camera.setupCamera(config);


  const [quadBindGroup, quadPipeline] = drawQuadInit(device);

  renderPrediction(device, swapChain, pipeline, quadBindGroup, quadPipeline);
};

(async () => {
  await app();
})();
*/
