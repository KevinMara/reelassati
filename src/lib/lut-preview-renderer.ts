import { applyCubeLutPixels, type CubeLut } from "@contracts/color-lut";

const vertexShader = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;

export const LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D sourceFrame;
uniform sampler3D lookup;
uniform vec3 domainMin;
uniform vec3 domainMax;
uniform float gridSize;
uniform float amount;
in vec2 uv;
out vec4 outputColor;
void main(){
  vec4 source=texture(sourceFrame,uv);
  vec3 p=clamp((source.rgb-domainMin)/(domainMax-domainMin),0.0,1.0)*(gridSize-1.0);
  ivec3 lo=ivec3(floor(p));
  ivec3 hi=min(lo+ivec3(1),ivec3(int(gridSize)-1));
  vec3 f=fract(p);
  vec3 a=mix(texelFetch(lookup,ivec3(lo.x,lo.y,lo.z),0).rgb,texelFetch(lookup,ivec3(hi.x,lo.y,lo.z),0).rgb,f.x);
  vec3 b=mix(texelFetch(lookup,ivec3(lo.x,hi.y,lo.z),0).rgb,texelFetch(lookup,ivec3(hi.x,hi.y,lo.z),0).rgb,f.x);
  vec3 c=mix(texelFetch(lookup,ivec3(lo.x,lo.y,hi.z),0).rgb,texelFetch(lookup,ivec3(hi.x,lo.y,hi.z),0).rgb,f.x);
  vec3 d=mix(texelFetch(lookup,ivec3(lo.x,hi.y,hi.z),0).rgb,texelFetch(lookup,ivec3(hi.x,hi.y,hi.z),0).rgb,f.x);
  vec3 looked=clamp(mix(mix(a,b,f.y),mix(c,d,f.y),f.z),0.0,1.0);
  outputColor=vec4(mix(source.rgb,looked,amount),source.a);
}`;

type PreviewSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
export interface LutPreviewRenderer {
  mode: "webgl" | "cpu";
  draw(
    source: PreviewSource,
    width: number,
    height: number,
    lut: CubeLut,
    amount: number
  ): void;
  dispose(): void;
}

/** Frame-driven GPU processing. The video element continues to own decoding,
 * playback and sound; color never seeks, replaces or starts another video. */
export function createLutPreviewRenderer(
  canvas: HTMLCanvasElement
): LutPreviewRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw new Error("Color look preview is unavailable in this browser.");
    return {
      mode: "cpu",
      draw(source, width, height, lut, amount) {
        const scale = Math.min(1, 320 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        applyCubeLutPixels(lut, pixels.data, amount);
        context.putImageData(pixels, 0, 0);
      },
      dispose() {
        canvas.width = canvas.height = 1;
      },
    };
  }
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const sourceTexture = gl.createTexture(),
    lutTexture = gl.createTexture();
  const dispose = () => {
    gl.deleteTexture(sourceTexture);
    gl.deleteTexture(lutTexture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
  };
  try {
    if (!program || !buffer || !sourceTexture || !lutTexture)
      throw new Error("Color look preview could not initialize.");
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexShader],
      [gl.FRAGMENT_SHADER, LUT_FRAGMENT_SHADER],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Color look preview could not initialize.");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Color look preview could not compile.");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Color look preview could not initialize.");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, "sourceFrame"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, lutTexture);
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_3D, parameter, gl.NEAREST);
    for (const parameter of [
      gl.TEXTURE_WRAP_S,
      gl.TEXTURE_WRAP_T,
      gl.TEXTURE_WRAP_R,
    ])
      gl.texParameteri(gl.TEXTURE_3D, parameter, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, "lookup"), 1);
    const minimum = gl.getUniformLocation(program, "domainMin"),
      maximum = gl.getUniformLocation(program, "domainMax");
    const size = gl.getUniformLocation(program, "gridSize"),
      strength = gl.getUniformLocation(program, "amount");
    let currentLut: CubeLut | undefined;
    return {
      mode: "webgl",
      draw(source, width, height, lut, amount) {
        if (gl.isContextLost())
          throw new Error("Color look preview lost its graphics context.");
        const scale = Math.min(1, 1280 / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale)),
          h = Math.max(1, Math.round(height * scale));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        if (currentLut !== lut) {
          const rgba = new Float32Array(lut.size ** 3 * 4);
          for (let i = 0, j = 0; i < lut.data.length; i += 3, j += 4) {
            rgba[j] = lut.data[i];
            rgba[j + 1] = lut.data[i + 1];
            rgba[j + 2] = lut.data[i + 2];
            rgba[j + 3] = 1;
          }
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_3D, lutTexture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage3D(
            gl.TEXTURE_3D,
            0,
            gl.RGBA32F,
            lut.size,
            lut.size,
            lut.size,
            0,
            gl.RGBA,
            gl.FLOAT,
            rgba
          );
          if (gl.getError() !== gl.NO_ERROR)
            throw new Error(
              "Color look preview could not load the color grid."
            );
          gl.uniform3fv(minimum, lut.domainMin);
          gl.uniform3fv(maximum, lut.domainMax);
          gl.uniform1f(size, lut.size);
          currentLut = lut;
        }
        gl.uniform1f(strength, Math.max(0, Math.min(1, amount)));
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source
        );
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
