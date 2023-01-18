/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-webgpu';

import * as tf from '@tensorflow/tfjs-core';

import {Camera} from './camera';
import * as TensorRenderer from './tensor_renderer';

let camera
let rafId;

async function renderResult(renderParameter) {
  const {device, swapChain, texturePipeline, quadBindGroup, quadPipeline} =
      renderParameter;
  if (camera.video.readyState < 2) {
    await new Promise((resolve) => {
      camera.video.onloadeddata = () => {
        resolve(video);
      };
    });
  }
  if (useTensorRenderer) {
    TensorRenderer.drawTexture(
        device, swapChain, texturePipeline, camera.video);
    TensorRenderer.drawQuad(device, swapChain, quadBindGroup, quadPipeline);
  } else {
    camera.drawCtx();

    // The null check makes sure the UI is not in the middle of changing to a
    // different model. If during model change, the result is from an old model,
    camera.drawResults(poses);
  }
}

async function renderPrediction(renderParameter) {
  await renderResult(renderParameter);
  rafId = requestAnimationFrame(function() {
    renderPrediction(renderParameter);
  });
};

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
const useTensorRenderer = true;
async function app() {
  // Gui content will change depending on which model is in the query string.
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('model')) {
    alert('Cannot find model in the query string.');
    return;
  }


  camera = await Camera.setupCamera(
      {targetFPS: 60, sizeOption: '640 X 480'}, useTensorRenderer);

  if (useTensorRenderer) {
    const [device, swapChain] = await TensorRenderer.getDevice('output');
    const texturePipeline =
        TensorRenderer.drawTextureInit(device, camera.video);

    const tensorBuffer = getTensorBuffer();
    const [quadBindGroup, quadPipeline] =
        TensorRenderer.drawQuadInit(device, tensorBuffer);
    const renderParameter =
        {device, swapChain, texturePipeline, quadBindGroup, quadPipeline};
    renderPrediction(renderParameter);
  } else {
    renderPrediction();
  }
};

app();
