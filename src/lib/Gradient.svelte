<script lang="ts">
	import frag from './fragment.txt?raw';
	import { hexToRgb } from 'ventoui-utils';
	import { onMount, onDestroy } from 'svelte';
	import type { Warp, Grain, GradientOptions } from '$lib/index.js';

	let {
		points = [],
		radius = 0.6,
		intensity = 1.0,
		warp: initialWarp = {},
		speed = 1.0,
		grain: initialGrain = {},
		maxPoints = 12,
		seed = Math.random(),
		playerState = $bindable('loading'),
		useWorker = true,
		...rest
	}: GradientOptions = $props();

	const defaultWarp: Required<Warp> = { mode: 0, amount: 0, size: 1 };
	const defaultGrain: Required<Grain> = { amount: 0, size: 1 };

	const warp: Required<Warp> = $derived({ ...defaultWarp, ...initialWarp });
	const grain: Required<Grain> = $derived({ ...defaultGrain, ...initialGrain });
	const browser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

	let canvas: HTMLCanvasElement | undefined = $state();
	let gl: WebGLRenderingContext | undefined = $state();
	let program: WebGLProgram | undefined = $state();
	let worker: Worker | undefined = $state();

	let uniforms: Record<string, WebGLUniformLocation> = {} as Record<string, WebGLUniformLocation>;
	let frameId: number;
	let running = true;
	let lastTime = 0;
	let animTime = 0;

	const shaderUniforms = ['u_resolution',
		'u_time', 'u_count', 'u_colors',
		'u_positions', 'u_radius', 'u_intensity',
		'u_warpMode', 'u_warpSize', 'u_warpAmount',
		'u_grainAmount', 'u_grainSize', 'u_seed'
	];

	const vert = `attribute vec2 a_pos;
void main() {
gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

	function createShader(gl: WebGLRenderingContext, type: number, src: string) {
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

	function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
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

	function resizeCanvasToDisplaySize() {
		if (!canvas) return false;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		const width = Math.floor(canvas.clientWidth * dpr);
		const height = Math.floor(canvas.clientHeight * dpr);
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			if (useWorker && worker) {
				worker.postMessage({
					type: 'resize',
					width: canvas.clientWidth,
					height: canvas.clientHeight,
					dpr
				});
			}
			return true;
		}
		return false;
	}

	function updateUniforms() {
		if (useWorker && worker) {
			const colorsArr = new Float32Array(maxPoints * 3);
			const posArr = new Float32Array(maxPoints * 2);

			for (let i = 0; i < points.length && i < maxPoints; i++) {
				const [r, g, b] = hexToRgb(points[i].color);
				colorsArr.set([r, g, b], i * 3);
				posArr.set([points[i].x, points[i].y], i * 2);
			}

			if (!canvas) return;
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			const width = Math.floor(canvas.clientWidth * dpr);
			const height = Math.floor(canvas.clientHeight * dpr);

			worker.postMessage({
				type: 'updateUniforms',
				uniforms: {
					u_resolution: [width, height],
					u_colors: colorsArr,
					u_positions: posArr,
					u_count: Math.min(points.length, maxPoints),
					u_radius: radius,
					u_intensity: intensity,
					u_warpMode: warp.mode,
					u_warpSize: warp.size,
					u_warpAmount: warp.amount,
					u_grainAmount: grain.amount,
					u_grainSize: grain.size,
					u_seed: seed
				}
			});
		} else if (!useWorker && gl && program && canvas) {
			gl.useProgram(program);
			gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);

			const colorsArr = new Float32Array(maxPoints * 3);
			const posArr = new Float32Array(maxPoints * 2);

			for (let i = 0; i < points.length && i < maxPoints; i++) {
				const [r, g, b] = hexToRgb(points[i].color);
				colorsArr.set([r, g, b], i * 3);
				posArr.set([points[i].x, points[i].y], i * 2);
			}

			gl.uniform3fv(uniforms.u_colors, colorsArr);
			gl.uniform2fv(uniforms.u_positions, posArr);
			gl.uniform1i(uniforms.u_count, Math.min(points.length, maxPoints));
			gl.uniform1f(uniforms.u_radius, radius);
			gl.uniform1f(uniforms.u_intensity, intensity);
			gl.uniform1i(uniforms.u_warpMode, warp.mode);
			gl.uniform1f(uniforms.u_warpSize, warp.size);
			gl.uniform1f(uniforms.u_warpAmount, warp.amount);
			gl.uniform1f(uniforms.u_grainAmount, grain.amount);
			gl.uniform1f(uniforms.u_grainSize, grain.size);
			gl.uniform1f(uniforms.u_seed, seed);
		}
	}

	function render(time: number) {
		if (useWorker && worker) {
			if (lastTime === 0) lastTime = time;
			const dt = (time - lastTime) * 0.001;
			lastTime = time;
			animTime += dt * speed;

			worker.postMessage({
				type: 'render',
				time: animTime
			});

			if (running) {
				playerState = 'playing';
				frameId = requestAnimationFrame(render);
			} else {
				playerState = 'paused';
			}
		} else if (!useWorker && gl && program && canvas) {
			// Main thread rendering
			if (lastTime === 0) lastTime = time;
			const dt = (time - lastTime) * 0.001;
			lastTime = time;
			animTime += dt * speed;

			resizeCanvasToDisplaySize();
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);
			gl.uniform1f(uniforms.u_time, animTime);
			updateUniforms();
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			if (running) {
				playerState = 'playing';
				frameId = requestAnimationFrame(render);
			} else {
				playerState = 'paused';
			}
		}
	}

	function getUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
		const loc = gl.getUniformLocation(program, name);
		if (!loc) throw new Error(`Uniform ${name} not found`);
		return loc;
	}

	onMount(() => {
		if (!canvas || !browser) return;
		playerState = 'loading';

		if (useWorker) {
			// Initialize web worker
			console.log('🔄 Initializing Gradient Web Worker...');
			worker = new Worker(new URL('./gradient.worker.ts', import.meta.url), { type: 'module' });
			
			worker.onmessage = (event: MessageEvent) => {
				const { type } = event.data;
				if (type === 'ready') {
					console.log('✅ Worker ready, rendering on offscreen canvas');
					// Send initial uniforms now that worker is ready
					updateUniforms();
					playerState = 'playing';
				} else if (type === 'rendering') {
					playerState = 'playing';
				} else if (type === 'paused') {
					console.log('⏸️ Worker paused');
					playerState = 'paused';
				} else if (type === 'error') {
					console.error('❌ Worker error:', event.data.error);
					playerState = 'paused';
				}
			};

			// Set initial canvas size before transferring control
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			const width = Math.floor(canvas.clientWidth * dpr);
			const height = Math.floor(canvas.clientHeight * dpr);
			canvas.width = width;
			canvas.height = height;
			console.log(`📐 Canvas initial size: ${width}x${height}`);

			try {
				const offscreenCanvas = canvas.transferControlToOffscreen();
				worker.postMessage({
					type: 'init',
					offscreenCanvas,
					fragShader: frag,
					speed
				}, [offscreenCanvas]);
				console.log('📨 Sent init message to worker with offscreen canvas');
				
				// Monitor canvas size changes and notify worker
				const resizeObserver = new ResizeObserver(() => {
					if (!canvas) return;
					const dpr = Math.max(1, window.devicePixelRatio || 1);
					const width = Math.floor(canvas.clientWidth * dpr);
					const height = Math.floor(canvas.clientHeight * dpr);
					console.log(`📐 Canvas resized to: ${width}x${height}`);
					worker?.postMessage({
						type: 'resize',
						width: canvas.clientWidth,
						height: canvas.clientHeight,
						dpr
					});
				});
				resizeObserver.observe(canvas);

				// Start animation loop on main thread
				frameId = requestAnimationFrame(render);
			} catch (error) {
				console.warn('⚠️ Could not transfer canvas to worker, falling back to main thread', error);
				useWorker = false;
				// Fall through to main thread setup
			}
		}

		if (!useWorker) {
			console.log('🎬 Rendering on main thread (worker disabled)');
			gl = canvas.getContext('webgl', { antialias: true })!;
			if (!gl) {
				console.warn('WebGL not supported');
				playerState = 'paused';
				return;
			}

			program = createProgram(gl, vert, frag);
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

			frameId = requestAnimationFrame(render);
			window.addEventListener('resize', updateUniforms);
		}
	});

	onDestroy(() => {
		running = false;
		if (!browser) return;
		
		if (useWorker && worker) {
			worker.postMessage({ type: 'destroy' });
			worker.terminate();
		} else if (frameId) {
			cancelAnimationFrame(frameId);
			window.removeEventListener('resize', updateUniforms);
		}
	});

	$effect(() => {
		if (!useWorker && gl && program) {
			updateUniforms();
		} else if (useWorker && worker && (points.length || radius || intensity || warp || grain || seed)) {
			updateUniforms();
		}
	});
</script>

<canvas bind:this={canvas} {...rest}></canvas>

<style>
	canvas { width: 100%; height: 100%; display: block; }
</style>
