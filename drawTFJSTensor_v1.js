import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-webgpu';
import * as tf from '@tensorflow/tfjs-core';

import {Camera} from './camera';
import {drawInit, drawTexture, createExternalTextureSamplingTestPipeline} from './webgpu_draw_texture';
import {createBindGroup, createIndexBuffer, createUniformBuffer, createVertexBuffer, presentationFormat} from './webgpu_util';

let rafId;
function getShader() {
  const vertexShaderCode = `
  struct Uniforms {
    x : f32,
    y : f32,
    width : f32,
    height : f32,
  }
  
  @binding(0) @group(0) var<uniform> uniforms : Uniforms;
  @vertex
  fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec4<f32>,
    @location(1) uv : vec2<f32>
  ) -> @builtin(position) vec4<f32> {
      let positionOut = vec4<f32>(position.x + uniforms.x, position.y * 1.8, position.z, position.w);
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

// prettier-ignore
// TODO: below data is for a cube, but we only need a rectangle.
export const cubeVertexArray = new Float32Array([
  // float4 position, float4 color, float2 uv,
  0.5,  0.5,  1, 1, 1, 0, 1, 1, 1, 1, -0.5, 0.5,  1, 1, 0, 0, 1, 1, 0, 1,
  -0.5, -0.5, 1, 1, 1, 0, 1, 1, 1, 1, 0.5,  -0.5, 1, 1, 0, 0, 0, 1, 0, 0,
]);

export const indexArray = new Uint32Array([
  // float4 position, float4 color, float2 uv,
  0, 1, 1, 2, 2, 3, 3, 0
]);

export const cubeVertexSize = 4 * 10;  // Byte size of one cube vertex.
export const cubePositionOffset = 0;
export const cubeColorOffset =
    4 * 4;  // Byte offset of cube vertex color attribute.
export const cubeUVOffset = 4 * 8;
export const cubeVertexCount = 4;

let frameIndex = 0;
function recordAndSubmit(pipeline) {
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

async function drawQuad(pipeline) {
  recordAndSubmit(pipeline);
}

let indexBuffer;
let verticesBuffer;
let uniformBuffer;
let bindGroup;


 function getTensorBuffer() {
  const data = [0.2, 0.2, 1, 1];
  const dataB = [0, 0, 0, 0];
  const size = 48;
  tf.env().set('WEBGPU_CPU_FORWARD', false);
  const a = tf.tensor(data, [4], 'float32');
  const b = tf.tensor(dataB, [4], 'float32');
  const c = tf.add(a, b);
  // await c.data();
  const res = c.dataToGPU();
  return res.buffer;
}

function drawQuadInit() {
  // Create a vertex buffer from the cube data.
  verticesBuffer = createVertexBuffer(device, cubeVertexArray);
  indexBuffer = createIndexBuffer(device, indexArray);
  uniformBuffer = createUniformBuffer(device);


  const [vertexShaderCode, fragmentShaderCode] = getShader();
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({code: vertexShaderCode}),
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: cubeVertexSize,
          attributes: [
            {
              // position
              shaderLocation: 0,
              offset: cubePositionOffset,
              format: 'float32x4',
            },
            {
              // uv
              shaderLocation: 1,
              offset: cubeUVOffset,
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
          format: presentationFormat,
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
  bindGroup = createBindGroup(device, pipeline, uniformBuffer, 16);
  return pipeline;
}

const kWidth = 640;
const kHeight = 480;

async function renderResult() {
  if (camera.video.readyState < 2) {
    await new Promise((resolve) => {
      camera.video.onloadeddata = () => {
        resolve(video);
      };
    });
  }
  drawTexture(device, swapChain, pipeline, camera.video);
  await drawQuad(quadPipeline);
}

async function renderPrediction() {
  await renderResult();
  rafId = requestAnimationFrame(renderPrediction);
};

export async function getTFJSDevice() {
  await tf.setBackend('webgpu');
  await tf.ready();
  const device = tf.backend().device;

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


async function drawTFJSInit() {
  const [device, swapChain, presentationFormat] = await getTFJSDevice();
  const pipeline = createExternalTextureSamplingTestPipeline(device);
  return [device, swapChain, pipeline];
}

let camera;
let quadPipeline;
let device, swapChain, pipeline;
let tensorBuffer;
async function app() {
  const [device1, swapChain1, pipeline1] = await drawTFJSInit();
  device = device1;
  swapChain = swapChain1;
  pipeline = pipeline1;
  tensorBuffer = getTensorBuffer();
  console.log(tensorBuffer.usage);

  // Gui content will change depending on which model is in the query string.
  const config = {sizeOption: '640 X 480', targetFPS: 60};
  camera = await Camera.setupCamera(config);


  quadPipeline = drawQuadInit();

  renderPrediction(device, swapChain, pipeline);
};

(async () => {
  await app();
})();
