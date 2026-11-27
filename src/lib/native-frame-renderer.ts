import {
  nativeSampleAt,
  type NativeFrameProgram,
} from "@contracts/native-frame-program";
import { nativeMattes } from "@contracts/native-motion-mattes";
import type { NativeMatteFrame } from "./native-matte-reader";

export type NativeImageInput =
  TexImageSource | { width: number; height: number; pixels: Float32Array };
const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D imageA;
uniform sampler2D imageB;
uniform sampler2D maskSheet;
uniform vec4 maskRegion;
uniform vec2 maskScale;
uniform vec2 size;
uniform int operation;
uniform float weight;
uniform vec2 center;
uniform vec2 pivot;
uniform vec2 scales;
uniform float angle;
uniform int edges;
uniform vec4 cropEdges;
uniform int shutterCount;
uniform vec4 shutterX[21];
uniform vec3 shutterY[21];
out vec4 result;
int modulo(int p,int n){return ((p%n)+n)%n;}
ivec2 mapped(ivec2 p){
  ivec2 n=ivec2(size);
  if(edges==1)return ivec2(modulo(p.x,n.x),modulo(p.y,n.y));
  if(edges==3){ivec2 q=ivec2(modulo(p.x,2*n.x),modulo(p.y,2*n.y));return min(q,2*n-q-1);}
  return clamp(p,ivec2(0),n-1);
}
vec4 pixel(ivec2 p){
  if(edges==0&&(p.x<0||p.y<0||p.x>=int(size.x)||p.y>=int(size.y)))return vec4(0.);
  return texelFetch(imageA,mapped(p),0);
}
float cubic(float x){
  x=abs(x);
  if(x<=1.)return (1.5*x-2.5)*x*x+1.;
  if(x<2.)return ((-.5*x+2.5)*x-4.)*x+2.;
  return 0.;
}
vec4 sampleImage(vec2 p){
  ivec2 base=ivec2(floor(p));vec2 f=fract(p);vec4 sum=vec4(0.);
  for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++)
    sum+=pixel(base+ivec2(x,y))*cubic(float(x)-f.x)*cubic(float(y)-f.y);
  return sum;
}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  if(operation==6){
    vec3 pos=vec3(gl_FragCoord.xy,1.);
    vec4 total=vec4(0.);
    for(int i=0;i<21;i++){
      if(i>=shutterCount)break;
      if(shutterX[i].w>0.)
        total+=sampleImage(vec2(dot(shutterX[i].xyz,pos),dot(shutterY[i],pos)));
    }
    result=total/float(shutterCount);
    return;
  }
  if(operation==0){result=texelFetch(imageA,ivec2(p.x,int(size.y)-1-p.y),0);return;}
  if(operation==7){vec4 src=texelFetch(imageA,p,0);result=vec4(src.rgb*weight,src.a);return;}
  if(operation==1){result=mix(texelFetch(imageA,p,0),texelFetch(imageB,p,0),weight);return;}
  if(operation==5){
    vec2 uv=(gl_FragCoord.xy/size-.5)*maskScale+.5;
    uv=1.-abs(mod(uv,2.)-1.);
    vec2 local=clamp(uv*maskRegion.zw,vec2(.5),maskRegion.zw-.5);
    float matte=texture(maskSheet,(maskRegion.xy+local)/vec2(textureSize(maskSheet,0))).r;
    result=mix(texelFetch(imageA,p,0),texelFetch(imageB,p,0),weight>0.5?matte:1.-matte);return;
  }
  // Fusion Normal/Over uses premultiplied foreground + background*(1-alpha).
  // Blend mixes the finished composite back against its background input.
  if(operation==3){vec4 bg=texelFetch(imageA,p,0),fg=texelFetch(imageB,p,0);result=mix(bg,fg+bg*(1.-fg.a),weight);return;}
  if(operation==4){
    // Crop removes picture; it never scales or stretches the retained region.
    // Pixel area coverage preserves fractional authored crop edges and alpha.
    vec2 lo=vec2(cropEdges.x,cropEdges.z)*size;
    vec2 hi=(vec2(1.)-vec2(cropEdges.y,cropEdges.w))*size;
    vec2 coverage=max(vec2(0.),min(vec2(p)+1.,hi)-max(vec2(p),lo));
    result=texelFetch(imageA,p,0)*coverage.x*coverage.y;return;
  }
  if(abs(scales.x)<1e-8||abs(scales.y)<1e-8){result=vec4(0.);return;}
  // Textures retain top-down source rows. Native positive angles turn counter-clockwise.
  // Center translates the picture. Pivot is the point about which size and
  // rotation act; moving it alone leaves an identity transform unchanged.
  vec2 anchor=vec2(pivot.x,1.-pivot.y)*size;
  vec2 shift=vec2(center.x-.5,.5-center.y)*size;
  vec2 d=gl_FragCoord.xy-anchor-shift;
  float c=cos(angle),s=sin(angle);
  vec2 source=vec2((c*d.x-s*d.y)/scales.x,(s*d.x+c*d.y)/scales.y)
    +anchor-.5;
  result=sampleImage(source);
}`;
/** Shared browser/export frame renderer. Float intermediates preserve native
 * overshoot and dissolve math; only the displayed/encoded frame is clamped.
 * Input/output RGBA is premultiplied; transparent edges remain transparent. */
export function createNativeFrameRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 8192))
    throw new Error("Invalid native render dimensions");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null;
  if (!gl || !gl.getExtension("EXT_color_buffer_float"))
    throw new Error("This browser cannot render floating-point effects");
  if (
    width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
    height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
  )
    throw new Error("Native effect exceeds GPU texture size");
  const shader = (kind: number, source: string) => {
    const s = gl.createShader(kind)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Native renderer shader failed: ${error}`);
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, vertex),
    fs = shader(gl.FRAGMENT_SHADER, fragment);
  const pipeline = gl.createProgram()!;
  gl.attachShader(pipeline, vs);
  gl.attachShader(pipeline, fs);
  gl.linkProgram(pipeline);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(pipeline, gl.LINK_STATUS))
    throw new Error("Native renderer shader could not link");
  gl.useProgram(pipeline);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(pipeline, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(
    [
      "imageA",
      "imageB",
      "maskSheet",
      "maskRegion",
      "maskScale",
      "size",
      "operation",
      "weight",
      "center",
      "pivot",
      "scales",
      "angle",
      "edges",
      "cropEdges",
      "shutterCount",
      "shutterX[0]",
      "shutterY[0]",
    ].map(n => [n, gl.getUniformLocation(pipeline, n)])
  );
  gl.uniform1i(uniforms.imageA, 0);
  gl.uniform1i(uniforms.imageB, 1);
  gl.uniform1i(uniforms.maskSheet, 1);
  gl.uniform2f(uniforms.size, width, height);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.viewport(0, 0, width, height);
  const shutterX = new Float32Array(21 * 4);
  const shutterY = new Float32Array(21 * 3);
  const textures = new Map<string, WebGLTexture>(),
    framebuffers = new Map<string, WebGLFramebuffer>();
  let disposed = false,
    output: string | undefined;
  let maskTexture: WebGLTexture | null = null;
  let previousSheet: ImageBitmap | undefined;
  const texture = (id: string) => {
    let t = textures.get(id);
    if (t) return t;
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      width,
      height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    );
    textures.set(id, t);
    return t;
  };
  const framebuffer = (id: string) => {
    let f = framebuffers.get(id);
    if (f) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      return f;
    }
    f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture(id),
      0
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Native effect framebuffer is incomplete");
    framebuffers.set(id, f);
    return f;
  };
  const bind = (id: string, unit: number) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture(id));
  };
  return {
    render(
      program: NativeFrameProgram,
      inputs: [NativeImageInput, NativeImageInput],
      frame: number,
      matte?: NativeMatteFrame
    ) {
      if (disposed || gl.isContextLost())
        throw new Error("Native effect renderer is unavailable");
      if (width * height * (program.nodes.length + 2) > 64_000_000)
        throw new Error("Native effect exceeds this renderer's memory limit");
      const needed = new Set([
        ...program.inputs,
        ...program.nodes.map(n => n.id),
      ]);
      for (const [id, t] of textures)
        if (!needed.has(id)) {
          gl.deleteTexture(t);
          textures.delete(id);
          const f = framebuffers.get(id);
          if (f) gl.deleteFramebuffer(f);
          framebuffers.delete(id);
        }
      gl.useProgram(pipeline);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      inputs.forEach((input, index) => {
        bind(`input-${index}`, 0);
        if ("pixels" in input) {
          if (
            input.width !== width ||
            input.height !== height ||
            input.pixels.length !== width * height * 4
          )
            throw new Error("Native input dimensions do not match");
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            width,
            height,
            gl.RGBA,
            gl.FLOAT,
            input.pixels
          );
        } else {
          const w =
            "videoWidth" in input
              ? input.videoWidth
              : "naturalWidth" in input
                ? input.naturalWidth
                : "displayWidth" in input
                  ? input.displayWidth
                  : input.width;
          const h =
            "videoHeight" in input
              ? input.videoHeight
              : "naturalHeight" in input
                ? input.naturalHeight
                : "displayHeight" in input
                  ? input.displayHeight
                  : input.height;
          if (w !== width || h !== height)
            throw new Error(
              "Native input must be composed at the output size first"
            );
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.FLOAT, input);
        }
      });
      for (const node of program.nodes) {
        framebuffer(node.id);
        if (node.kind === "gain") {
          bind(node.input, 0);
          gl.uniform1i(uniforms.operation, 7);
          gl.uniform1f(uniforms.weight, nativeSampleAt(node.samples, frame).gain);
        } else if (node.kind === "matte") {
          if (!matte) throw new Error("The authored transition mask is missing");
          bind(node.a, 0);
          bind(node.b, 1);
          gl.activeTexture(gl.TEXTURE2);
          if (!maskTexture) {
            maskTexture = gl.createTexture();
            if (!maskTexture) throw new Error("The transition mask texture could not be allocated");
            gl.bindTexture(gl.TEXTURE_2D, maskTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          }
          gl.bindTexture(gl.TEXTURE_2D, maskTexture);
          if (previousSheet !== matte.sheet) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, matte.sheet);
            previousSheet = matte.sheet;
          }
          gl.uniform1i(uniforms.maskSheet, 2);
          gl.uniform1i(uniforms.operation, 5);
          const source = nativeMattes[node.matteId];
          gl.uniform1f(uniforms.weight, source.inverted ? 1 : 0);
          gl.uniform2f(uniforms.maskScale, source.mirrorCanvas ? source.mirrorCanvas[0] / source.width : 1,
            source.mirrorCanvas ? source.mirrorCanvas[1] / source.height : 1);
          gl.uniform4f(uniforms.maskRegion, matte.left, matte.top, matte.width, matte.height);
        } else if (node.kind === "mix" || node.kind === "over") {
          bind(node.a, 0);
          bind(node.b, 1);
          gl.uniform1i(uniforms.operation, node.kind === "mix" ? 1 : 3);
          gl.uniform1f(
            uniforms.weight,
            nativeSampleAt(node.samples, frame).mix
          );
        } else if (node.kind === "crop") {
          const s = nativeSampleAt(node.samples, frame);
          bind(node.input, 0);
          bind(node.input, 1);
          gl.uniform1i(uniforms.operation, 4);
          gl.uniform4f(uniforms.cropEdges, s.left, s.right, s.top, s.bottom);
        } else if (node.kind === "transform") {
          const s = nativeSampleAt(node.samples, frame);
          bind(node.input, 0);
          bind(node.input, 1);
          gl.uniform1i(uniforms.operation, 2);
          gl.uniform2f(uniforms.center, ...s.center);
          gl.uniform2f(uniforms.pivot, ...s.pivot);
          gl.uniform2f(uniforms.scales, s.scaleX, s.scaleY);
          gl.uniform1f(uniforms.angle, (s.angle * Math.PI) / 180);
          gl.uniform1i(uniforms.edges, s.edges);
          if (s.shutter) {
            for (const [i, pose] of s.shutter.entries()) {
              const ox = (pose.pivot[0] + pose.center[0] - .5) * width;
              const oy = (1 - pose.pivot[1] + .5 - pose.center[1]) * height;
              const radians = pose.angle * Math.PI / 180;
              const cos = Math.cos(radians), sin = Math.sin(radians);
              if (Math.abs(pose.scaleX) < 1e-8 || Math.abs(pose.scaleY) < 1e-8) {
                shutterX[i * 4 + 3] = 0;
                continue;
              }
              const xx = cos / pose.scaleX, xy = -sin / pose.scaleX;
              const yx = sin / pose.scaleY, yy = cos / pose.scaleY;
              shutterX.set([xx, xy, pose.pivot[0] * width - .5 - xx * ox - xy * oy, 1], i * 4);
              shutterY.set([yx, yy, (1 - pose.pivot[1]) * height - .5 - yx * ox - yy * oy], i * 3);
            }
            gl.uniform1i(uniforms.operation, 6);
            gl.uniform1i(uniforms.shutterCount, s.shutter.length);
            gl.uniform4fv(uniforms["shutterX[0]"], shutterX);
            gl.uniform3fv(uniforms["shutterY[0]"], shutterY);
          }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      output = program.output;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      bind(output, 0);
      gl.uniform1i(uniforms.operation, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const error = gl.getError();
      if (error !== gl.NO_ERROR)
        throw new Error(`Native effect GPU failed (${error})`);
    },
    readFloatFrame() {
      if (disposed || !output) throw new Error("No native frame has rendered");
      framebuffer(output);
      const pixels = new Float32Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return pixels;
    },
    dispose(releaseContext = false) {
      if (disposed) return;
      disposed = true;
      for (const t of textures.values()) gl.deleteTexture(t);
      for (const f of framebuffers.values()) gl.deleteFramebuffer(f);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(maskTexture);
      gl.deleteProgram(pipeline);
      textures.clear();
      framebuffers.clear();
      if (releaseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
