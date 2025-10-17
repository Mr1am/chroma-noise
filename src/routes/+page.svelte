<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Sidebar from './Sidebar.svelte';
	import { Gradient, type GradientOptions } from '$lib/index.js';
	import { browser } from '$app/environment';
	import 'ventoui-styles';
	import { Button } from 'ventoui-button';
	import { type FlyParams, flyIn, flyOut } from 'svelte-fancy-transitions';

	interface Point { color: string; x: number; y: number; }
	interface Props {
		points?: Point[];
		radius?: number;
		intensity?: number;
	}

	const DEFAULT_POINTS: Point[] = [
		{ color: '#ee399d', x: 0.15, y: 0.15 },
		{ color: '#12ffa6', x: 0.75, y: 0.22 },
		{ color: '#ffd926', x: 0.15, y: 0.82 },
		{ color: '#2adbff', x: 0.82, y: 0.82 }
	];
	const DEFAULT_RADIUS = 0.6;
	const DEFAULT_INTENSITY = 1.0;
	const DEFAULT_WARP_MODE = 0;
	const DEFAULT_WARP_SIZE = 1.0;
	const DEFAULT_TIME_AMOUNT = 1.0;
	const DEFAULT_WARP_AMOUNT = 0.0;
	const DEFAULT_GRAIN_AMOUNT = 0.0;
	const DEFAULT_GRAIN_SIZE = 1.0;
	const DEFAULT_SEED = Math.random();

	const toastParams: FlyParams = { reverse: true }

	let { radius = $bindable(DEFAULT_RADIUS), intensity = $bindable(DEFAULT_INTENSITY) }: Props = $props();

	let points = $state(DEFAULT_POINTS.map(p => ({ ...p })));
	let stageEl: HTMLElement | null = $state(null);
	let draggingIndex: number | null = null;
	let rectCache: DOMRect | null = null;
	let warpMode = $state(DEFAULT_WARP_MODE);
	let warpSize = $state(DEFAULT_WARP_SIZE);
	let timeAmount = $state(DEFAULT_TIME_AMOUNT);
	let warpAmount = $state(DEFAULT_WARP_AMOUNT);
	let grainAmount = $state(DEFAULT_GRAIN_AMOUNT);
	let grainSize = $state(DEFAULT_GRAIN_SIZE);
	let seed = $state(DEFAULT_SEED);
	let handlersVisible = $state(true);

	let toast = $state<{ msg: string; visible: boolean }>({ msg: '', visible: false });
	let toastTimer: number | null = null;

	function showToast(msg: string, ms = 1600) {
		if (toastTimer) {
			clearTimeout(toastTimer);
			toastTimer = null;
		}
		toast = { msg, visible: true };
		toastTimer = window.setTimeout(() => {
			toast = { msg: '', visible: false };
			toastTimer = null;
		}, ms);
	}

	function clamp01(v: number) {
		return Math.min(1, Math.max(0, v));
	}

	function startPointerDrag(e: PointerEvent, idx: number) {
		e.preventDefault();
		draggingIndex = idx;
		rectCache = stageEl?.getBoundingClientRect() ?? null;
		const target = e.currentTarget as Element | null;
		try {
			target?.setPointerCapture?.(e.pointerId);
		} catch (e) {
			console.log(e);
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (draggingIndex === null) return;
		if (!rectCache) rectCache = stageEl?.getBoundingClientRect() ?? null;
		if (!rectCache) return;

		const x = (e.clientX - rectCache.left) / rectCache.width;
		const y = (e.clientY - rectCache.top) / rectCache.height;
		points = points.map((p, i) =>
			i === draggingIndex ? { ...p, x: clamp01(x), y: clamp01(1 - y) } : p
		);
	}

	function onPointerUp() {
		draggingIndex = null;
		rectCache = null;
	}

	function handleOptions(e: CustomEvent) {
		const d = (e as any).detail ?? e;
		if (typeof d.radius === 'number') radius = d.radius;
		if (typeof d.intensity === 'number') intensity = d.intensity;
		if (typeof d.warpMode === 'number') warpMode = d.warpMode;
		if (typeof d.warpSize === 'number') warpSize = d.warpSize;
		if (typeof d.warpAmount === 'number') warpAmount = d.warpAmount;
		if (typeof d.timeAmount === 'number') timeAmount = d.timeAmount;
		if (typeof d.grainAmount === 'number') grainAmount = d.grainAmount;
		if (typeof d.grainSize === 'number') grainSize = d.grainSize;
		if (typeof d.seed === 'number') seed = d.seed;
	}

	onMount(() => {
		if (!browser) return;
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	});

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		if (toastTimer) clearTimeout(toastTimer);
	});

	function resetDefaults() {
		points = DEFAULT_POINTS.map(p => ({ ...p }));
		radius = DEFAULT_RADIUS;
		intensity = DEFAULT_INTENSITY;
		warpMode = DEFAULT_WARP_MODE;
		warpSize = DEFAULT_WARP_SIZE;
		timeAmount = DEFAULT_TIME_AMOUNT;
		warpAmount = DEFAULT_WARP_AMOUNT;
		grainAmount = DEFAULT_GRAIN_AMOUNT;
		grainSize = DEFAULT_GRAIN_SIZE;
		seed = DEFAULT_SEED;
		showToast('Reset to defaults');
	}

	function buildConfigObject(): GradientOptions {
		return {
			points: points.map(p => ({ ...p })),
			radius,
			intensity,
			warp: {
				mode: warpMode,
				amount: warpAmount,
				size: warpSize
			},
			speed: timeAmount,
			grain: {
				amount: grainAmount,
				size: grainSize
			},
			seed
		};
	}

	async function exportToClipboard() {
		const config: GradientOptions = buildConfigObject();
		const json = JSON.stringify(config, null, 2);
		if (!browser) {
			showToast('Export is not available');
			return;
		}
		try {
			await navigator.clipboard.writeText(json);
			showToast('Copied to clipboard');
		} catch (err) {
			downloadJSON('gradient-config.json', json);
			showToast('Copy failed');
		}
	}

	async function exportToJson() {
		const config: GradientOptions = buildConfigObject();
		const json = JSON.stringify(config, null, 2);
		if (!browser) {
			showToast('Export is not available');
			return;
		}
		try {
			await navigator.clipboard.writeText(json);
			downloadJSON('gradient-config.json', json);
		} catch (err) {
			showToast('Download failed');
		}
	}

	function downloadJSON(filename: string, data: string) {
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}
</script>

<div class="wrap">
	<div class="stage" bind:this={stageEl}>
		<Gradient
			{points}
			{radius}
			{intensity}
			warp={{ mode: warpMode, amount: warpAmount, size: warpSize}}
			speed={timeAmount}
			grain={{amount: grainAmount, size: grainSize}}
			{seed}
		/>
		{#each points as p, i}
			<div
				class="handle {handlersVisible ? '' : 'hidden'}"
				style="left: {p.x * 100}%; top: {100 - p.y * 100}%; background: {p.color}"
				onpointerdown={(e) => startPointerDrag(e, i)}
				aria-label={`color-handle-${i}`}
			></div>
		{/each}

		{#if toast.visible}
			{#key toast.msg}
			<div role="status" class="toast-container" aria-live="polite">
				<span class="toast radius-large" in:flyIn|global={toastParams} out:flyOut|global={toastParams}>
					{toast.msg}
				</span>
			</div>
			{/key}
		{/if}
	</div>

	<Sidebar
		bind:points={points}
		{radius}
		{intensity}
		{grainAmount}
		{grainSize}
		bind:warpMode={warpMode}
		{warpSize}
		{warpAmount}
		{timeAmount}
		{seed}
		options={(e) => handleOptions(e)}
		bind:handlers={handlersVisible}>
		<Button glare class="s radius-large" onclick={exportToClipboard} aria-label="export-config">Copy setup</Button>
		<Button glare class="s radius-large" onclick={exportToJson} aria-label="export-config">Download setup</Button>
		<Button glare class="s radius-large" onclick={resetDefaults} aria-label="reset-defaults">Reset</Button>
	</Sidebar>
</div>

<style>
	.wrap {
		display: flex;
		height: 100dvh;
		width: 100vw;
		overflow: hidden;
	}
	.stage {
		position: relative;
		flex: 1 1 auto;
		overflow: hidden;
	}

	.handle {
		position: absolute;
		width: 24px;
		height: 24px;
		border-radius: 1rem;
		border: 4px solid rgba(255, 255, 255, 0.95);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		transform: translate(-50%, -50%);
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		touch-action: none;
		margin: 0;
		user-select: none;
		transition: opacity 0.25s;
	}

	.handle.hidden {
		opacity: 0;
	}

	.toast {
		padding: 8px 14px;
		background: var(--bg-tint);
		backdrop-filter: blur(1rem);
		font-size: var(--p);
	}

	.toast-container {
		position: absolute;
		left: 50%;
		bottom: var(--m);
		width: fit-content;
		transform: translateX(-50%);
		z-index: 50;
	}

	@media screen and (width < 640px) {
		.wrap {
			flex-direction: column;
		}
		.handle {
			width: 30px;
			height: 30px;
			border: 6px solid rgba(255, 255, 255, 0.95);
		}
	}
</style>