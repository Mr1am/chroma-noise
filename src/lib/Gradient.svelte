<script lang="ts">
	import vert from './gradient.vert.glsl?raw';
	import frag from './gradient.frag.glsl?raw';
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
			return true;
		}
		return false;
	}

	function updateUniforms() {
		if (!gl || !program || !canvas) return;
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

	function render(time: number) {
		if (!gl || !program || !canvas) return;
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

		if (running) frameId = requestAnimationFrame(render);
	}

	function getUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
		const loc = gl.getUniformLocation(program, name);
		if (!loc) throw new Error(`Uniform ${name} not found`);
		return loc;
	}

	onMount(() => {
		if (!canvas || !browser) return;
		gl = canvas.getContext('webgl', { antialias: true })!;
		if (!gl) return console.warn('WebGL not supported');

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
	});

	onDestroy(() => {
		running = false;
		if (!canvas || !browser) return;
		if (frameId) cancelAnimationFrame(frameId);
		window.removeEventListener('resize', updateUniforms);
	});

	$effect(() => {
		if (gl && program) updateUniforms();
	});
</script>

<canvas bind:this={canvas} {...rest}></canvas>

<style>
	canvas { width: 100%; height: 100%; display: block; }
</style>
