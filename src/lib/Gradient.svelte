<script lang="ts">
	import frag from './fragment.txt?raw';
	import { onMount, onDestroy } from 'svelte';
	import { hexToRgb, isBrowser, createGradientWorker, getTargetSize } from '$lib/index.js';
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
		currentState = $bindable('loading'),
		class: c = '',
		resolution = {},
		blendMode = 'legacy',
		...rest
	}: GradientOptions = $props();

	const defaultWarp: Required<Warp> = { mode: 0, amount: 0, size: 1 };
	const defaultGrain: Required<Grain> = { amount: 0, size: 1 };

	const warp: Required<Warp> = $derived({ ...defaultWarp, ...initialWarp });
	const grain: Required<Grain> = $derived({ ...defaultGrain, ...initialGrain });

	let canvas: HTMLCanvasElement | undefined = $state();
	let worker: Worker | undefined = $state();
	let running = $state(false);
	let lastTime = 0;
	let animTime = 0;
	let frame: number | null = null;
	let currentCanvasSize = $state({ width: 0, height: 0 });

	let lastUniforms = $state<Record<string, any>>({});

	function updateUniforms() {
		if (!worker) return;

		const colorsArr = new Float32Array(maxPoints * 3);
		const posArr = new Float32Array(maxPoints * 2);

		for (let i = 0; i < points.length && i < maxPoints; i++) {
			const [r, g, b] = hexToRgb(points[i].color);
			colorsArr.set([r, g, b], i * 3);
			posArr.set([points[i].x, points[i].y], i * 2);
		}

		const newUniforms = {
			u_colors: colorsArr,
			u_positions: posArr,
			u_count: Math.min(points.length, maxPoints),
			u_radius: radius,
			u_intensity: intensity,
			u_warpMode: Number(warp.mode),
			u_warpSize: warp.size,
			u_warpAmount: warp.amount,
			u_grainAmount: grain.amount,
			u_grainSize: grain.size,
			u_seed: seed,
			u_blendMode: blendMode === 'new' ? 0 : 1
		};

		const changedUniforms: Record<string, any> = {};
		for (const [key, value] of Object.entries(newUniforms)) {
			if (JSON.stringify(lastUniforms[key]) !== JSON.stringify(value)) {
				changedUniforms[key] = value;
			}
		}

		if (Object.keys(changedUniforms).length > 0) {
			worker.postMessage({
				type: 'updateUniforms',
				uniforms: changedUniforms
			});
			lastUniforms = { ...newUniforms };
		}
	}

	function resizeCanvasToDisplaySize() {
		if (!canvas || !worker) return;
		
		const { width, height } = getTargetSize(canvas, resolution);

		if (currentCanvasSize.width !== width || currentCanvasSize.height !== height) {
			currentCanvasSize = { width, height };
			worker.postMessage({
				type: 'resize',
				width,
				height
			});
		}
	}

	$effect(() => {
		if (worker) {
			updateUniforms();
		}
	});
	
	$effect(() => {
		if (worker) {
			resizeCanvasToDisplaySize();
		}
	});

	function render(time: number) {
		if (!worker) return;

		if (lastTime === 0) lastTime = time;
		const dt = (time - lastTime) * 0.001;
		lastTime = time;
		animTime += dt * speed;

		worker.postMessage({
			type: 'render',
			time: animTime
		});

		if (running) {
			currentState = 'playing';
			frame = requestAnimationFrame(render);
		}
	}

	onMount(() => {
		if (!canvas || !isBrowser()) return;
		currentState = 'loading';

		worker = createGradientWorker();

		worker.onmessage = (event: MessageEvent) => {
			const { type } = event.data;
			if (type === 'ready') {
				updateUniforms();
				currentState = 'playing';
				frame = requestAnimationFrame(render);
			} else if (type === 'error') {
				console.error('Worker error:', event.data.error);
				currentState = 'paused';
			}
		};

		const { width, height } = getTargetSize(canvas, resolution);
		currentCanvasSize = { width, height };

		try {
			const offscreenCanvas = canvas.transferControlToOffscreen();
			worker.postMessage(
				{
					type: 'init',
					offscreenCanvas,
					fragShader: frag
				},
				[offscreenCanvas]
			);
			worker.postMessage({ type: 'resize', width, height });
			running = true;
		} catch (error) {
			console.error('Could not transfer canvas to worker: ', error);
		}
	});

	onDestroy(() => {
		running = false;
		if (!isBrowser()) return;

		if (frame) cancelAnimationFrame(frame);
		if (worker) {
			worker.postMessage({ type: 'destroy' });
			worker.terminate();
		}
	});

	$effect(() => {
		if (worker && (points.length || radius || intensity || warp || grain || seed)) {
			updateUniforms();
		}
	});
</script>

<canvas bind:this={canvas} {...rest} class="{currentState} {c}"></canvas>

<style>
	canvas {
		width: 100%;
		height: 100%;
		display: block;
		transition: opacity 1s ease-out;
	}
	canvas.loading {
		opacity: 0;
	}
	canvas.playing {
		opacity: 1;
	}
</style>
