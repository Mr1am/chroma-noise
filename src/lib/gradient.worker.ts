import { SHADER_UNIFORMS, VERTEX_SHADER, createProgram, getUniform, setupQuadBuffer, setUniform } from './utils.js';
import type { RenderMessage } from './index.js';

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let uniforms: Record<string, WebGLUniformLocation> = {};
let currentUniforms: Record<string, any> = {};

function initWorker(offscreenCanvas: OffscreenCanvas, fragShader: string) {
	try {
		gl = offscreenCanvas.getContext('webgl2', { antialias: true }) as WebGL2RenderingContext;
		if (!gl) {
			throw new Error('WebGL2 not supported');
		}

		program = createProgram(gl, VERTEX_SHADER, fragShader);
		gl.useProgram(program);

		setupQuadBuffer(gl, program);

		for (const name of SHADER_UNIFORMS) {
			uniforms[name] = getUniform(gl, program, name);
		}

		self.postMessage({ type: 'ready' });
	} catch (error) {
		self.postMessage({ type: 'error', error: (error as Error).message });
	}
}

function performRender(time: number) {
	if (!gl || !program || Object.keys(currentUniforms).length === 0) {
		return;
	}

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(program);
	gl.uniform1f(uniforms.u_time, time);

	for (const [key, value] of Object.entries(currentUniforms)) {
		const uniform = uniforms[key];
		if (uniform) setUniform(gl, uniform, key, value);
	}

	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

self.onmessage = (event: MessageEvent<RenderMessage>) => {
	const { type } = event.data;

	switch (type) {
		case 'init': {
			const { offscreenCanvas, fragShader } = event.data;
			if (offscreenCanvas && fragShader) {
				initWorker(offscreenCanvas, fragShader);
			}
			break;
		}
		case 'render': {
			const { time } = event.data;
			if (time !== undefined) {
				performRender(time);
			}
			break;
		}
		case 'updateUniforms': {
			const { uniforms: newUniforms } = event.data;
			if (newUniforms) {
				currentUniforms = newUniforms;
			}
			break;
		}
		case 'resize': {
			const { width, height, dpr } = event.data;
			if (gl && width && height && dpr) {
				const scaledWidth = Math.floor(width);
				const scaledHeight = Math.floor(height);
				gl.canvas.width = scaledWidth;
				gl.canvas.height = scaledHeight;
				currentUniforms = {
					...currentUniforms,
					u_resolution: [scaledWidth, scaledHeight]
				};
			}
			break;
		}
		case 'destroy': {
			break;
		}
	}
};

export {};
