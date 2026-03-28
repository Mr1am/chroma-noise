<script lang="ts">
	import { Button } from 'ventoui-button';
	import { Slider } from 'ventoui-slider';
	import { slide } from 'svelte/transition';
	import type { Point } from '$lib/index.js';
	import Container from './Container.svelte';

	interface Props {
		points?: Point[];
		radius?: number;
		intensity?: number;
		warpMode?: number;
		warpSize?: number;
		warpAmount?: number;
		timeAmount?: number;
		grainAmount?: number;
		grainSize?: number;
		grainAnimate?: boolean;
		seed?: number;
		handlers?: boolean;
		resolution?: import('$lib/index.js').Resolution;
		blendMode?: import('$lib/index.js').BlendMode;
		children?: import('svelte').Snippet;
	}

	let {
		points = $bindable([]),
		radius = $bindable(0.6),
		intensity = $bindable(1.0),
		timeAmount = $bindable(1.0),
		warpMode = $bindable(0),
		warpSize = $bindable(1.0),
		warpAmount = $bindable(0.0),
		grainAmount = $bindable(0.0),
		grainSize = $bindable(1.0),
		handlers = $bindable(true),
		resolution = $bindable({}),
		blendMode = $bindable('new'),
		seed = $bindable(Math.random()),
		children
	}: Props = $props();

	function addPoint() {
		if (points.length >= 12) return;
		points = [...points, { color: '#ffffff', x: 0.5, y: 0.5 }];
	}
	function removePoint(i: number) {
		points = points.filter((_, idx) => idx !== i);
	}
	function updatePoint(i: number, partial: Partial<(typeof points)[0]>) {
		points = points.map((p, idx) => (idx === i ? { ...p, ...partial } : p));
	}

	function randomizeSeed() {
		seed = Math.random();
	}
</script>

<aside class="sidebar">
	<Container>
		<h1>Colors</h1>
		<span class="div"></span>
		<div class="colors">
			{#each points as point, i}
				<div class="point-row" transition:slide|global={{ axis: 'x' }}>
					<input
						class="color-input"
						type="color"
						bind:value={point.color}
						oninput={(e) => updatePoint(i, { color: e.target.value })}
					/>
					<button class="remove-btn centered" onclick={() => removePoint(i)}>✕</button>
				</div>
			{/each}
			<Button glare class="add-btn centered s-inline width-fit radius-large" onclick={addPoint}>+</Button>
		</div>
	</Container>
	<Container>
		<h1>Blend</h1>
		<span class="div"></span>
		<Slider label={`Radius: ${radius.toFixed(2)}`} min={0.01} max={2} step={0.01} bind:value={radius}
		></Slider>
		<Slider
			label={`Intensity: ${intensity.toFixed(2)}`}
			min={0.01}
			max={3}
			step={0.01}
			bind:value={intensity}
		></Slider>
		<div class="horizontal gap-xs center">
			<p>Mode</p>
			<select class="plain width-fill radius-large" bind:value={blendMode}>
				<option value="new">New</option>
				<option value="legacy">Legacy</option>
			</select>
			</div>
	</Container>
	<Container>
		<h1>Warp</h1>
		<span class="div"></span>
		<div class="horizontal gap-xs">
			<p>Mode</p>
			<select class="plain width-fill radius-large" bind:value={warpMode}>
				<option value="0">None</option>
				<option value="1">Waves</option>
				<option value="2">Simplex Noise</option>
				<option value="3">FBM (fractal)</option>
				<option value="4">Ridged</option>
				<option value="5">Swirl</option>
				<option value="6">Radial waves</option>
			</select>
		</div>
		<Slider
			label={`Size: ${warpSize.toFixed(2)}`}
			min={0.05}
			max={10}
			step={0.05}
			bind:value={warpSize}
		></Slider>
		<Slider
			label={`Amount: ${warpAmount.toFixed(2)}`}
			min={0}
			max={2}
			step={0.01}
			bind:value={warpAmount}
		></Slider>
		<div class="horizontal gap-xs center">
			<p>Seed:</p>
			<input
				class="width-fill s sec radius-large"
				type="number"
				min="0"
				max="1"
				step="0.001"
				bind:value={seed}
			/>
			<Button
				glare
				class="centered radius-large s width-fit"
				onclick={randomizeSeed}>Random</Button>
		</div>
	</Container>
	<Container>
		<h1>Animation</h1>
		<span class="div"></span>
		<Slider
			label={`Speed: ${timeAmount.toFixed(2)}`}
			min={0}
			max={5}
			step={0.01}
			bind:value={timeAmount}
		></Slider>
	</Container>

	<Container>
		<h1>Grain</h1>
		<span class="div"></span>
		<Slider
			label={`Amount: ${grainAmount.toFixed(2)}`}
			min={0}
			max={0.25}
			step={0.005}
			bind:value={grainAmount}
		></Slider>
		<Slider label={`Size: ${grainSize.toFixed(2)}`} min={0} max={20} step={0.1} bind:value={grainSize}
		></Slider>
	</Container>

	<Container>
		<h1>Resolution</h1>
		<span class="div"></span>
		<div class="horizontal gap-xs">
			<p>Width</p>
			<input class="width-fill s sec radius-large" type="number" min="100" max="4000" bind:value={resolution.width} placeholder="auto" />
		</div>
		<div class="horizontal gap-xs">
			<p>Height</p>
			<input class="width-fill s sec radius-large" type="number" min="100" max="4000" bind:value={resolution.height} placeholder="auto" />
		</div>
		<div class="horizontal gap-xs">
			<p>Modifier</p>
			<input class="width-fill s sec radius-large" type="number" min="0.01" max="2" step="0.01" bind:value={resolution.modifier} placeholder="1.0" />
		</div>
		<div class="horizontal gap-xs">
			<p>Use DPR</p>
			<input type="checkbox" bind:checked={resolution.useDPR} />
		</div>
	</Container>

	<Container>
		<h1>Color handlers</h1>
		<span class="div"></span>
		<div class="horizontal gap-xs start">
			<p>Show</p>
			<input type="checkbox" class="height-fill" bind:checked={handlers} />
		</div>
	</Container>

	{@render children?.()}
</aside>

<style>
	h1,
	p {
		text-align: left;
	}
	h1 {
		font-size: 1rem;
		font-weight: 500;
		text-transform: uppercase;
	}
	.colors {
		display: flex;
		overflow: scroll hidden;
		scrollbar-width: thin;
		padding-bottom: var(--xs);
		gap: 0.25rem;
		min-height: 4rem;
	}
	.centered {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sidebar {
		width: 20rem;
		min-width: 20rem;
		padding: 0.5rem;
		box-sizing: border-box;
		background: #111;
		color: #ddd;
		overflow: hidden scroll;
		gap: var(--s);
		display: flex;
		flex-direction: column;
		touch-action: auto;
	}

	.sidebar * {
		touch-action: auto;
	}
	.point-row {
		display: flex;
		align-items: center;
		position: relative;
		padding: 0.25rem;
		font-size: 0.6rem;
	}
	.color-input {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 1rem;
		border: none;
		background: none;
	}
	.remove-btn {
		background: #222;
		border: none;
		color: #fff;
		border-radius: 2rem;
		cursor: pointer;
		position: absolute;
		right: 0;
		top: 0;
		width: 1.2rem;
		height: 1.2rem;
	}

	input[type='color']::-webkit-color-swatch {
		border: none;
		padding: 0;
		margin: -0.5rem;
	}

	p {
		padding-block: 0.5rem;
	}

	select {
		background: var(--bg);
	}

	@media screen and (width < 640px) {
		.sidebar {
			width: 100vw;
			height: 35dvh;
		}
	}

	.div {
		display: flex;
		margin-block: 0.5rem;
		height: 1px;
		min-height: 1px;
		width: 100%;
		background: var(--fg-tint-hover);
	}

	:global(.slider-container) {
		gap: 0.25rem;
		padding-top: 0.5rem;
	}
</style>
