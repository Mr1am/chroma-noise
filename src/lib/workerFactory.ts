/**
 * Worker factory that creates a gradient rendering worker as a Blob
 * This approach ensures the worker works correctly when the package is consumed by other projects
 */

export function createGradientWorker(): Worker {
	const workerCode = `
		const SHADER_UNIFORMS = [
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

		const VERTEX_SHADER = 'attribute vec2 a_pos;void main() {gl_Position = vec4(a_pos, 0.0, 1.0);}';
		const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

		const UNIFORM_TYPES = {
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

		let gl = null;
		let program = null;
		let uniforms = {};
		let currentUniforms = {};

		function createShader(gl, type, src) {
			const s = gl.createShader(type);
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
				const error = gl.getShaderInfoLog(s);
				gl.deleteShader(s);
				throw new Error(\`Shader compile error: \${error}\`);
			}
			return s;
		}

		function createProgram(gl, vsSrc, fsSrc) {
			const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
			const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
			const p = gl.createProgram();
			gl.attachShader(p, vs);
			gl.attachShader(p, fs);
			gl.linkProgram(p);
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
				const error = gl.getProgramInfoLog(p);
				gl.deleteProgram(p);
				throw new Error(\`Program link error: \${error}\`);
			}
			return p;
		}

		function getUniform(gl, program, name) {
			const loc = gl.getUniformLocation(program, name);
			if (!loc) throw new Error(\`Uniform \${name} not found\`);
			return loc;
		}

		function setupQuadBuffer(gl, program) {
			const vbo = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
			gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
			const a_pos = gl.getAttribLocation(program, 'a_pos');
			gl.enableVertexAttribArray(a_pos);
			gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
		}

		function setUniform(gl, uniform, key, value) {
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

		function initWorker(offscreenCanvas, fragShader) {
			try {
				gl = offscreenCanvas.getContext('webgl2', { antialias: true });
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
				self.postMessage({ type: 'error', error: error.message });
			}
		}

		function performRender(time) {
			if (!gl || !program) {
				return;
			}

			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);
			gl.uniform1f(uniforms.u_time, time);
			gl.uniform2f(uniforms.u_resolution, gl.canvas.width, gl.canvas.height);

			for (const [key, value] of Object.entries(currentUniforms)) {
				const uniform = uniforms[key];
				if (uniform && key !== 'u_resolution') setUniform(gl, uniform, key, value);
			}

			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}

		self.onmessage = (event) => {
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
						currentUniforms = { ...currentUniforms, ...newUniforms };
					}
					break;
				}
				case 'resize': {
					const { width, height } = event.data;
					if (gl && width && height) {
						gl.canvas.width = width;
						gl.canvas.height = height;
					}
					break;
				}
				case 'destroy': {
					break;
				}
			}
		};
	`;

	const blob = new Blob([workerCode], { type: 'application/javascript' });
	const workerUrl = URL.createObjectURL(blob);
	return new Worker(workerUrl);
}
