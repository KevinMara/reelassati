---
license: apache-2.0
pipeline_tag: image-segmentation
tags:
- background-removal
---

## Usage (Transformers.js)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@huggingface/transformers) using:
```bash
npm i @huggingface/transformers
```

**Example:** Selfie segmentation with `onnx-community/mediapipe_selfie_segmentation`.

```js
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';

// Load model and processor
const model_id = 'onnx-community/mediapipe_selfie_segmentation';
const model = await AutoModel.from_pretrained(model_id, { dtype: 'fp32' });
const processor = await AutoProcessor.from_pretrained(model_id);

// Load image from URL
const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/selfie_segmentation.png';
const image = await RawImage.read(url);

// Pre-process image
const inputs = await processor(image);

// Predict alpha matte
const { alphas } = await model(inputs);

// Save output mask
const mask = await RawImage.fromTensor(alphas[0].mul(255).to('uint8')).resize(image.width, image.height);
mask.save('mask.png');

// (Optional) Apply mask to original image
const result = image.clone().putAlpha(mask);
result.save('result.png');
```

| Input image | Predicted mask | Output image |
| :----------:|:------------:|:------------:|
| ![image/png](https://cdn-uploads.huggingface.co/production/uploads/61b253b7ac5ecaae3d1efe0c/NR--WRELcGKsY8c7dI7s5.png) | ![image/png](https://cdn-uploads.huggingface.co/production/uploads/61b253b7ac5ecaae3d1efe0c/tAsPevxCzxGank2iHXo7o.png) | ![image/png](https://cdn-uploads.huggingface.co/production/uploads/61b253b7ac5ecaae3d1efe0c/8RMmqdfcgr4cclN5Dv6ae.png) |