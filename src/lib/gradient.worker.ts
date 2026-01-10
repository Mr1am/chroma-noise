/**
 * Web Worker for Gradient rendering
 * Handles WebGL rendering offloaded from the main thread
 */

interface RenderMessage {
	type: 'init' | 'render' | 'resize' | 'updateUniforms' | 'destroy';
	offscreenCanvas?: OffscreenCanvas;
	fragShader?: string;
	width?: number;
	height?: number;
	dpr?: number;
	uniforms?: Record<string, any>;
	time?: number;
	speed?: number;
}

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let uniforms: Record<string, WebGLUniformLocation> = {};
let frameId: number | null = null;
let running = true;
let lastTime = 0;
let animTime = 0;
let speed = 1.0;
let currentUniforms: Record<string, any> = {};

const shaderUniforms = [
	'u_resolution',
	'u_time',
	'u_count',
	'u_colors',
	'u_positions',
	'u_radius',
	'u_intensity',
	'u_warpMode',
	'u_warpSize',
	'u_warpAmount',
	'u_grainAmount',
	'u_grainSize',
	'u_seed'
];

const vert = `attribute vec2 a_pos;
void main() {
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

function createShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(s));
		gl.deleteShader(s);
		throw new Error('Shader compile error');
	}
	return s;
}

function createProgram(
	gl: WebGL2RenderingContext,
	vsSrc: string,
	fsSrc: string
): WebGLProgram {
	const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
	const p = gl.createProgram()!;
	gl.attachShader(p, vs);
	gl.attachShader(p, fs);
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(p));
		gl.deleteProgram(p);
		throw new Error('Program link error');
	}
	return p;
}

function getUniform(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	name: string
): WebGLUniformLocation {
	const loc = gl.getUniformLocation(program, name);
	if (!loc) throw new Error(`Uniform ${name} not found`);
	return loc;
}

function initWorker(offscreenCanvas: OffscreenCanvas, fragShader: string) {
	try {
		gl = offscreenCanvas.getContext('webgl2', { antialias: true }) as WebGL2RenderingContext;
		if (!gl) {
			throw new Error('WebGL2 not supported');
		}

		program = createProgram(gl, vert, fragShader);
		gl.useProgram(program);

		const verts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
		const vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
		const a_pos = gl.getAttribLocation(program, 'a_pos');
		gl.enableVertexAttribArray(a_pos);
		gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

		for (const name of shaderUniforms) {
			uniforms[name] = getUniform(gl, program, name);
		}

		console.log(`[Worker] ✅ WebGL initialized - Canvas: ${gl.canvas.width}x${gl.canvas.height}`);
		self.postMessage({ type: 'ready' });
	} catch (error) {
		console.error('[Worker] ❌ Init error:', error);
		self.postMessage({ type: 'error', error: (error as Error).message });
	}
}

function performRender(time: number) {
	if (!gl || !program) {
		console.warn('[Worker] Cannot render: gl or program not initialized');
		return;
	}

	if (Object.keys(currentUniforms).length === 0) {
		console.warn('[Worker] ⚠️ No uniforms set yet, skipping render');
		return;
	}

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(program);
	gl.uniform1f(uniforms.u_time, time);

	// Apply current uniforms
	for (const [key, value] of Object.entries(currentUniforms)) {
		if (!(key in uniforms)) continue;
		const uniform = uniforms[key];
		
		if (key === 'u_resolution') {
			gl.uniform2f(uniform, value[0], value[1]);
		} else if (key === 'u_colors') {
			gl.uniform3fv(uniform, value);
		} else if (key === 'u_positions') {
			gl.uniform2fv(uniform, value);
		} else if (key === 'u_count') {
			gl.uniform1i(uniform, value);
		} else if (key === 'u_warpMode') {
			gl.uniform1i(uniform, value);
		} else if (
			key === 'u_radius' ||
			key === 'u_intensity' ||
			key === 'u_warpSize' ||
			key === 'u_warpAmount' ||
			key === 'u_grainAmount' ||
			key === 'u_grainSize' ||
			key === 'u_seed'
		) {
			gl.uniform1f(uniform, value);
		}
	}

	gl.drawArrays(gl.TRIANGLES, 0, 6);
	console.log(`[Worker] 🎨 Rendered at time: ${time.toFixed(2)}, canvas: ${gl.canvas.width}x${gl.canvas.height}`);
}

self.onmessage = (event: MessageEvent<RenderMessage>) => {
	const { type } = event.data;
	console.log(`[Worker] 📨 Received:`, type);

	switch (type) {
		case 'init': {
			const { offscreenCanvas, fragShader, speed: initialSpeed } = event.data;
			if (offscreenCanvas && fragShader) {
				if (initialSpeed) speed = initialSpeed;
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
				console.log('[Worker] 📥 Updated uniforms:', {
					resolution: newUniforms.u_resolution,
					count: newUniforms.u_count,
					colors: newUniforms.u_colors ? `Float32Array(${newUniforms.u_colors.length})` : undefined
				});
			}
			break;
		}
		case 'resize': {
			const { width, height, dpr } = event.data;
			if (gl && width && height && dpr) {
				const scaledWidth = Math.floor(width * dpr);
				const scaledHeight = Math.floor(height * dpr);
				console.log(`[Worker] 📐 Resizing to ${scaledWidth}x${scaledHeight}`);
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
			console.log('[Worker] 💀 Shutting down');
			running = false;
			if (frameId) {
				cancelAnimationFrame(frameId);
			}
			break;
		}
	}
};

export {};
