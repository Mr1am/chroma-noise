export function hexToRgb(hex: string): [number, number, number] {
	hex = hex.replace('#', '');
	if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
	const num = parseInt(hex, 16);
	const r = ((num >> 16) & 255) / 255;
	const g = ((num >> 8) & 255) / 255;
	const b = (num & 255) / 255;
	return [r, g, b];
}

export const SHADER_UNIFORMS = [
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
] as const;

export const VERTEX_SHADER = `attribute vec2 a_pos;void main() {gl_Position = vec4(a_pos, 0.0, 1.0);}`;

export const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

export function createShader(
	gl: WebGL2RenderingContext | WebGLRenderingContext,
	type: number,
	src: string
): WebGLShader {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		const error = gl.getShaderInfoLog(s);
		gl.deleteShader(s);
		throw new Error(`Shader compile error: ${error}`);
	}
	return s;
}

export function createProgram(
	gl: WebGL2RenderingContext | WebGLRenderingContext,
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
		const error = gl.getProgramInfoLog(p);
		gl.deleteProgram(p);
		throw new Error(`Program link error: ${error}`);
	}
	return p;
}

export function getUniform(
	gl: WebGL2RenderingContext | WebGLRenderingContext,
	program: WebGLProgram,
	name: string
): WebGLUniformLocation {
	const loc = gl.getUniformLocation(program, name);
	if (!loc) throw new Error(`Uniform ${name} not found`);
	return loc;
}

export function setupQuadBuffer(
	gl: WebGL2RenderingContext | WebGLRenderingContext,
	program: WebGLProgram
): void {
	const vbo = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
	const a_pos = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(a_pos);
	gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
}

export function getCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
	const dpr = Math.max(1, window.devicePixelRatio || 1);
	const width = Math.floor(canvas.clientWidth * dpr);
	const height = Math.floor(canvas.clientHeight * dpr);
	return { width, height, dpr };
}

export const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Uniform type metadata for WebGL setters
 */
export const UNIFORM_TYPES: Record<string, 'vec2' | 'vec3f' | 'vec2f' | 'i32' | 'f32'> = {
	u_resolution: 'vec2',
	u_colors: 'vec3f',
	u_positions: 'vec2f',
	u_count: 'i32',
	u_warpMode: 'i32',
	u_radius: 'f32',
	u_intensity: 'f32',
	u_warpSize: 'f32',
	u_warpAmount: 'f32',
	u_grainAmount: 'f32',
	u_grainSize: 'f32',
	u_seed: 'f32'
};

/**
 * Set a WebGL uniform based on its type
 */
export function setUniform(
	gl: WebGL2RenderingContext,
	uniform: WebGLUniformLocation,
	key: string,
	value: any
): void {
	const type = UNIFORM_TYPES[key];
	if (!type) return;

	switch (type) {
		case 'vec2':
			gl.uniform2f(uniform, value[0], value[1]);
			break;
		case 'vec3f':
			gl.uniform3fv(uniform, value);
			break;
		case 'vec2f':
			gl.uniform2fv(uniform, value);
			break;
		case 'i32':
			gl.uniform1i(uniform, value);
			break;
		case 'f32':
			gl.uniform1f(uniform, value);
			break;
	}
}