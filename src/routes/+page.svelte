<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Sidebar from './Sidebar.svelte';
	import { Gradient } from '$lib/index.js';
	import { browser } from '$app/environment';
	import 'ventoui-styles';

	interface Props {
		points?: { color: string; x: number; y: number }[];
		radius?: number;
		intensity?: number;
	}

	let { points = $bindable([
		{ color: '#ff3b30', x: 0.15, y: 0.15 },
		{ color: '#00ff9f', x: 0.75, y: 0.22 },
		{ color: '#ffe04d', x: 0.15, y: 0.82 },
		{ color: '#44ff56', x: 0.82, y: 0.82 }
	]), radius = $bindable(0.6), intensity = $bindable(1.0) }: Props = $props();

	let stageEl: HTMLElement | null = $state(null);
	let draggingIndex: number | null = null;
	let rectCache: DOMRect | null = null;
	let warpMode = $state(0);
	let warpSize = $state(1.0);
	let timeAmount = $state(1.0);
	let warpAmount = $state(0.0);
	let grainAmount = $state(0.0);
	let grainSize = $state(1.0);
	let grainAnimate = $state(false);
	let seed = $state(Math.random());
	let handlersVisible = $state(true);

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

	function handleUIChange(e: CustomEvent) {
		if (e.points) {
			points = e.points;
		}
	}
	function handleOptions(e: CustomEvent) {
		if (typeof e.radius === 'number') radius = e.radius;
		if (typeof e.intensity === 'number') intensity = e.intensity;
		if (typeof e.warpMode === 'number') warpMode = e.warpMode;
		if (typeof e.warpSize === 'number') warpSize = e.warpSize;
		if (typeof e.warpAmount === 'number') warpAmount = e.warpAmount;
		if (typeof e.timeAmount === 'number') {
			timeAmount = e.timeAmount;
		}
		if (typeof e.grainAmount === 'number') grainAmount = e.grainAmount;
		if (typeof e.grainSize === 'number') grainSize = e.grainSize;
		if (typeof e.grainAnimate === 'boolean') grainAnimate = e.grainAnimate;
		if (typeof e.seed === 'number') seed = e.seed;
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
	});
</script>

<div class="wrap">
	<div class="stage" bind:this={stageEl}>
		<Gradient
			{points}
			{radius}
			{intensity}
			{warpMode}
			{warpSize}
			{timeAmount}
			{warpAmount}
			{grainAmount}
			{grainSize}
			{grainAnimate}
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
	</div>

	<Sidebar
		{points}
		{radius}
		{intensity}
		{grainAmount}
		{grainSize}
		{grainAnimate}
		{warpMode}
		{warpSize}
		{warpAmount}
		{timeAmount}
		{seed}
		change={(option) => handleUIChange(option)}
		options={(option) => handleOptions(option)}
		bind:handlers={handlersVisible}
	/>
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
