<script lang="ts">
	import vert from './gradient.vert.glsl?raw';
	import frag from './gradient.frag.glsl?raw';
	import { onMount, onDestroy } from 'svelte';
	import { hexToRgb } from 'ventoui-utils';
	import { browser } from '$app/environment';

	interface Props {
		points?: { color: string; x: number; y: number }[];
		radius?: number;
		timeAmount?: number;
		intensity?: number;
		warpMode?: number;
		warpSize?: number;
		warpAmount?: number;
		grainAmount?: number;
		grainSize?: number;
		seed?: number;
	}

	let {
		points = [],
		radius = 0.6,
		timeAmount = 1.0,
		intensity = 1.0,
		warpMode = 0,
		warpSize = 1.0,
		warpAmount = 0.0,
		grainAmount = 0.0,
		grainSize = 1.0,
		seed = Math.random()
	}: Props = $props();

	export const MAX_POINTS = 12;

	let canvas: HTMLCanvasElement | undefined = $state();
	let gl: WebGLRenderingContext | undefined = $state();
	let program: WebGLProgram | undefined = $state();

	let u_resolution: WebGLUniformLocation;
	let u_time: WebGLUniformLocation;
	let u_count: WebGLUniformLocation;
	let u_colors: WebGLUniformLocation;
	let u_positions: WebGLUniformLocation;
	let u_radius: WebGLUniformLocation;
	let u_intensity: WebGLUniformLocation;
	let u_warpMode: WebGLUniformLocation;
	let u_warpSize: WebGLUniformLocation;
	let u_warpAmount: WebGLUniformLocation;
	let u_grainAmount : WebGLUniformLocation;
	let u_grainSize : WebGLUniformLocation;
	let u_grainAnimate : WebGLUniformLocation;
	let u_seed: WebGLUniformLocation;

	let frameId: number;
	let running = true;

	let lastTime = 0;
	let animTime = 0;

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
		gl.uniform2f(u_resolution, canvas.width, canvas.height);

		const colorsArr = new Float32Array(MAX_POINTS * 3);
		const posArr = new Float32Array(MAX_POINTS * 2);
		for (let i = 0; i < points.length && i < MAX_POINTS; i++) {
			const [r, g, b] = hexToRgb(points[i].color);
			colorsArr[i * 3] = r;
			colorsArr[i * 3 + 1] = g;
			colorsArr[i * 3 + 2] = b;
			posArr[i * 2] = points[i].x;
			posArr[i * 2 + 1] = points[i].y;
		}

		gl.uniform3fv(u_colors, colorsArr);
		gl.uniform2fv(u_positions, posArr);
		gl.uniform1i(u_count, Math.min(points.length, MAX_POINTS));
		gl.uniform1f(u_radius, radius);
		gl.uniform1f(u_intensity, intensity);
		gl.uniform1i(u_warpMode, warpMode);
		gl.uniform1f(u_warpSize, warpSize);
		gl.uniform1f(u_warpAmount, warpAmount);
		gl.uniform1f(u_grainAmount, grainAmount);
		gl.uniform1f(u_grainSize, grainSize);
		gl.uniform1f(u_seed, seed);
	}

	function render(time: number) {
		if (!gl || !program || !canvas) return;
		if (lastTime === 0) lastTime = time;
		const dt = (time - lastTime) * 0.001;
		lastTime = time;
		animTime += dt * timeAmount;

		resizeCanvasToDisplaySize();
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(program);
		if (u_time) gl.uniform1f(u_time, animTime);

		updateUniforms();
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		if (running) frameId = requestAnimationFrame(render);
	}

	onMount(() => {
		if (!canvas || !browser) return;
		gl = canvas.getContext('webgl', { antialias: true })!;
		if (!gl) {
			console.warn('WebGL not supported');
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

		// @ts-ignore
		u_resolution = gl.getUniformLocation(program, 'u_resolution');
		// @ts-ignore
		u_time = gl.getUniformLocation(program, 'u_time');
		// @ts-ignore
		u_count = gl.getUniformLocation(program, 'u_count');
		// @ts-ignore
		u_colors = gl.getUniformLocation(program, 'u_colors');
		// @ts-ignore
		u_positions = gl.getUniformLocation(program, 'u_positions');
		// @ts-ignore
		u_radius = gl.getUniformLocation(program, 'u_radius');
		// @ts-ignore
		u_intensity = gl.getUniformLocation(program, 'u_intensity');
		// @ts-ignore
		u_warpMode = gl.getUniformLocation(program, 'u_warpMode');
		// @ts-ignore
		u_warpSize = gl.getUniformLocation(program, 'u_warpSize');
		// @ts-ignore
		u_warpAmount = gl.getUniformLocation(program, 'u_warpAmount');
		// @ts-ignore
		u_grainAmount = gl.getUniformLocation(program, 'u_grainAmount');
		// @ts-ignore
		u_grainSize = gl.getUniformLocation(program, 'u_grainSize');
		// @ts-ignore
		u_grainAnimate = gl.getUniformLocation(program, 'u_grainAnimate');
		// @ts-ignore
		u_seed = gl.getUniformLocation(program, 'u_seed');

		frameId = requestAnimationFrame(render);
		window.addEventListener('resize', updateUniforms);
	});

	onDestroy(() => {
		if (!browser) return;

		running = false;
		if (frameId) cancelAnimationFrame(frameId);
		window.removeEventListener('resize', updateUniforms);
	});

	$effect(() => {
		if (gl && program) {
			updateUniforms();
		}
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas { width: 100%; height: 100%; display: block; }
</style>