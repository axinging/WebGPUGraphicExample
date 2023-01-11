import {CineonToneMapping} from 'three';
import {Camera} from './camera';
let rafId;
function getShader() {
  const vertexShaderCode = `
        @vertex
        fn main(
          @builtin(vertex_index) VertexIndex : u32
        ) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 3>(
            vec2<f32>(0.0, 0.5),
            vec2<f32>(-0.5, -0.5),
            vec2<f32>(0.5, -0.5)
          );
          return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
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

function recordAndSubmit(device, swapChain, pipeline) {
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

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(3, 1, 0, 0);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}
const kFormat = 'bgra8unorm';
const presentationFormat = 'bgra8unorm';

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


async function drawQuad() {
  const [vertexShaderCode, fragmentShaderCode] = getShader();
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({code: vertexShaderCode}),
      entryPoint: 'main'
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
      topology: 'triangle-list',
    }
  });
  recordAndSubmit(device, swapChain, pipeline);
}

(async () => {
  await app();
})();


function createExternalTextureSamplingTestPipeline(device) {
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: `
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
          `,
      }),
      entryPoint: 'main',
    },
    fragment: {
      module: device.createShaderModule({
        code: `
        @group(0) @binding(0) var s : sampler;
        @group(0) @binding(1) var t : texture_external;

        @fragment fn main(@builtin(position) FragCoord : vec4<f32>)
                                 -> @location(0) vec4<f32> {
            return textureSampleBaseClampToEdge(t, s, FragCoord.xy / vec2<f32>(640.0, 480.0));
        }
          `,
      }),
      entryPoint: 'main',
      targets: [
        {
          format: kFormat,
        },
      ],
    },
    primitive: {topology: 'triangle-list'},
  });

  return pipeline;
}

function createExternalTextureSamplingTestBindGroup(device, source, pipeline) {
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


const kWidth = 640;
const kHeight = 480;
async function drawInit() {
  const [device, swapChain, presentationFormat] = await getDevice();


  const colorAttachment = device.createTexture({
    format: kFormat,
    size: {width: kWidth, height: kHeight, depthOrArrayLayers: 1},
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const pipeline = createExternalTextureSamplingTestPipeline(device);
  return [device, swapChain, pipeline];
}

function drawTexture(device, swapChain, pipeline, video) {
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

async function renderResult() {
  if (camera.video.readyState < 2) {
    await new Promise((resolve) => {
      camera.video.onloadeddata = () => {
        resolve(video);
      };
    });
  }
  drawTexture(device, swapChain, pipeline, camera.video);
  await drawQuad();
}

async function renderPrediction() {
  await renderResult();
  rafId = requestAnimationFrame(renderPrediction);
};

let camera;
let device, swapChain, pipeline;
async function app() {
  // Gui content will change depending on which model is in the query string.
  const config = {sizeOption: '640 X 480', targetFPS: 60};
  camera = await Camera.setupCamera(config);
  const [device1, swapChain1, pipeline1] = await drawInit();
  device = device1;
  swapChain = swapChain1;
  pipeline = pipeline1;


  renderPrediction(device, swapChain, pipeline);
};

// app();