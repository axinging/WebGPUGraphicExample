import {Camera} from './camera';
import {presentationFormat} from './webgpu_util';
import {drawInit,drawTexture} from './webgpu_draw_texture';
let rafId;
function getShader() {
  const vertexShaderCode = `
    @vertex
    fn main(
        @builtin(vertex_index) VertexIndex : u32
    ) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 8>(
        vec2<f32>(0.5, 0.5),
        vec2<f32>(-0.5, 0.5),
        vec2<f32>(-0.5, 0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(0.5, 0.5),
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

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(8, 1, 0, 0);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

async function drawQuad(pipeline) {
  recordAndSubmit(pipeline);
}

function drawQuadInit() {
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
        topology: 'line-list',
      }
    });
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

let camera;
let quadPipeline;
let device, swapChain, pipeline;
async function app() {
  // Gui content will change depending on which model is in the query string.
  const config = {sizeOption: '640 X 480', targetFPS: 60};
  camera = await Camera.setupCamera(config);
  const [device1, swapChain1, pipeline1] = await drawInit();
  device = device1;
  swapChain = swapChain1;
  pipeline = pipeline1;

  quadPipeline = drawQuadInit();

  renderPrediction(device, swapChain, pipeline);
};

(async () => {
  await app();
})();
