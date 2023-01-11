import {getDevice} from './webgpu_util';

function getShader() {
    const vertexShaderCode =
        `
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
    const fragmentShaderCode =
        `
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
            loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
        }]
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
}

(async () => {   
    const [device, swapChain, presentationFormat] = await getDevice();
    const [vertexShaderCode, fragmentShaderCode] = getShader();
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: vertexShaderCode
            }),
            entryPoint: 'main'
        },
        fragment: {
            module: device.createShaderModule({
                code: fragmentShaderCode
            }),
            entryPoint: 'main',
            targets: [{
                format: presentationFormat,
            }]
        },
        primitive: {
            topology: 'triangle-list',
        }
    });
    recordAndSubmit(device, swapChain, pipeline);
})();